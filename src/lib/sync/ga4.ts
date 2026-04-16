/**
 * GA4 sync: daily sessions/users/ecommerce per channel × source × medium via run_report.
 *
 * MCP server: https://mcp-analytics.up.railway.app/mcp  (SSE)
 * Tool: run_report
 * Property: 315856757 (Room99)
 */
import { db as defaultDb, type DB } from '@/lib/db';
import { callMCPTool, connectMCP } from './mcp-client';
import { toNum, toNumOrNull, upsertGA4Daily, type GA4DailyRow } from './upsert';
import { type DateRange } from '@/lib/periods';

const MCP_URL = process.env.MCP_GA4_URL || 'https://mcp-analytics.up.railway.app/mcp';
const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '315856757';

type GA4ReportRow = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
  // Some MCP servers flatten:
  dimensions?: Record<string, string>;
  metrics?: Record<string, string>;
};

type RunReportResponse = {
  rows?: GA4ReportRow[];
  data?: GA4ReportRow[];
  dimensionHeaders?: Array<{ name: string }>;
  metricHeaders?: Array<{ name: string }>;
} | GA4ReportRow[];

/**
 * GA4 returns YYYYMMDD for date dim → normalize to YYYY-MM-DD.
 */
function normalizeDate(s: string | undefined): string | null {
  if (!s) return null;
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}`;
  return s.slice(0, 10);
}

export async function syncGA4(
  range: DateRange,
  opts: { db?: DB } = {}
): Promise<{ rowsWritten: number }> {
  const database = opts.db ?? defaultDb;

  const dimensions = ['date', 'sessionDefaultChannelGroup', 'sessionSource', 'sessionMedium'];
  const metrics = [
    'sessions',
    'totalUsers',
    'newUsers',
    'engagedSessions',
    'bounceRate',
    'transactions',
    'purchaseRevenue',
    'itemsViewed',
    'addToCarts',
    'checkouts',
  ];

  const client = await connectMCP(MCP_URL, 'sse');
  try {
    const resp = await callMCPTool<RunReportResponse>(
      client,
      'run_report',
      {
        property_id: PROPERTY_ID,
        start_date: range.start,
        end_date: range.end,
        dimensions,
        metrics,
        limit: 100_000,
      },
      { retries: 3, initialBackoffMs: 1000 }
    );

    const raw: GA4ReportRow[] = Array.isArray(resp)
      ? resp
      : resp.rows ?? resp.data ?? [];

    const rows: GA4DailyRow[] = [];
    for (const r of raw) {
      // Prefer flat dimensions/metrics (some MCP impls), else decode arrays.
      const dimMap = r.dimensions ?? null;
      const metMap = r.metrics ?? null;

      const dimVals = r.dimensionValues?.map((d) => d.value) ?? [];
      const metVals = r.metricValues?.map((m) => m.value) ?? [];

      const get = (key: string, fallbackIdx: number) =>
        dimMap?.[key] ?? dimVals[fallbackIdx] ?? undefined;
      const getMetric = (key: string, fallbackIdx: number) =>
        metMap?.[key] ?? metVals[fallbackIdx] ?? undefined;

      const date = normalizeDate(get('date', 0));
      if (!date) continue;

      rows.push({
        date,
        channelGroup: get('sessionDefaultChannelGroup', 1) ?? 'Unassigned',
        source: get('sessionSource', 2) ?? '(direct)',
        medium: get('sessionMedium', 3) ?? '(none)',
        sessions: Math.round(toNum(getMetric('sessions', 0))),
        users: Math.round(toNum(getMetric('totalUsers', 1))),
        newUsers: Math.round(toNum(getMetric('newUsers', 2))),
        engagedSessions: Math.round(toNum(getMetric('engagedSessions', 3))),
        bounceRate: toNumOrNull(getMetric('bounceRate', 4))?.toString() ?? null,
        transactions: Math.round(toNum(getMetric('transactions', 5))),
        revenue: String(toNum(getMetric('purchaseRevenue', 6))),
        itemsViewed: Math.round(toNum(getMetric('itemsViewed', 7))),
        addToCart: Math.round(toNum(getMetric('addToCarts', 8))),
        beginCheckout: Math.round(toNum(getMetric('checkouts', 9))),
      });
    }

    const rowsWritten = await upsertGA4Daily(database, rows);
    return { rowsWritten };
  } finally {
    await client.close();
  }
}
