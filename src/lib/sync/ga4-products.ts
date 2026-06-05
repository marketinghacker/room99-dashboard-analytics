/**
 * GA4 ruch per produkt — itemsViewed / addToCarts / itemsPurchased / itemRevenue
 * per itemId. Łączymy z products_daily (Shoper, po SKU/nazwie) w Top produktach,
 * żeby odróżnić spadek sprzedaży z powodu ruchu od spadku konwersji.
 */
import { db as defaultDb, type DB } from '@/lib/db';
import { callMCPTool, connectMCP } from './mcp-client';
import { toNum, upsertGA4Products, type GA4ProductRow } from './upsert';
import { type DateRange } from '@/lib/periods';

const MCP_URL = process.env.MCP_GA4_URL || 'https://mcp-analytics.up.railway.app/mcp';
const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '315856757';
const USER_ID = process.env.MCP_GA4_USER_ID || 'marcin@marketing-hackers.com';

type GA4ReportRow = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
  dimensions?: Record<string, string>;
  metrics?: Record<string, string>;
};
type RunReportResponse = {
  rows?: GA4ReportRow[];
  data?: GA4ReportRow[];
} | GA4ReportRow[];

function normalizeDate(s: string | undefined): string | null {
  if (!s) return null;
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}`;
  return s.slice(0, 10);
}

export async function syncGA4Products(
  range: DateRange,
  opts: { db?: DB } = {}
): Promise<{ rowsWritten: number }> {
  const database = opts.db ?? defaultDb;

  const client = await connectMCP(MCP_URL, 'http');
  try {
    const resp = await callMCPTool<RunReportResponse>(
      client,
      'run_report',
      {
        user_id: USER_ID,
        property_id: PROPERTY_ID,
        start_date: range.start,
        end_date: range.end,
        dimensions: ['date', 'itemId', 'itemName'],
        metrics: ['itemsViewed', 'itemsAddedToCart', 'itemsPurchased', 'itemRevenue'],
        limit: 100_000,
      },
      { retries: 2, initialBackoffMs: 1000, timeoutMs: 60_000 }
    );

    const raw: GA4ReportRow[] = Array.isArray(resp) ? resp : resp.rows ?? resp.data ?? [];

    // Agregacja po PK (date, itemId) — ten sam itemId potrafi wystąpić z kilkoma
    // wariantami itemName; multi-row upsert nie znosi duplikatów klucza.
    const byKey = new Map<string, GA4ProductRow>();
    for (const r of raw) {
      const dimMap = r.dimensions ?? null;
      const metMap = r.metrics ?? null;
      const dimVals = r.dimensionValues?.map((d) => d.value) ?? [];
      const metVals = r.metricValues?.map((m) => m.value) ?? [];
      const get = (key: string, idx: number) => dimMap?.[key] ?? dimVals[idx] ?? undefined;
      const getMetric = (key: string, idx: number) => metMap?.[key] ?? metVals[idx] ?? undefined;

      const date = normalizeDate(get('date', 0));
      const itemId = get('itemId', 1);
      if (!date || !itemId || itemId === '(not set)') continue;

      const key = `${date}|${itemId}`;
      const itemsViewed = Math.round(toNum(getMetric('itemsViewed', 0)));
      const addToCarts = Math.round(toNum(getMetric('itemsAddedToCart', 1)));
      const itemsPurchased = Math.round(toNum(getMetric('itemsPurchased', 2)));
      const revenue = toNum(getMetric('itemRevenue', 3));
      const existing = byKey.get(key);
      if (existing) {
        existing.itemsViewed = (existing.itemsViewed ?? 0) + itemsViewed;
        existing.addToCarts = (existing.addToCarts ?? 0) + addToCarts;
        existing.itemsPurchased = (existing.itemsPurchased ?? 0) + itemsPurchased;
        existing.revenue = String(Number(existing.revenue ?? 0) + revenue);
      } else {
        byKey.set(key, {
          date,
          itemId,
          itemName: get('itemName', 2) ?? '',
          itemsViewed,
          addToCarts,
          itemsPurchased,
          revenue: String(revenue),
        });
      }
    }

    const rowsWritten = await upsertGA4Products(database, Array.from(byKey.values()));
    return { rowsWritten };
  } finally {
    await client.close().catch(() => {});
  }
}
