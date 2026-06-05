/**
 * GA4 funnel-by-users + mikrokonwersje GTM.
 *
 * Klient liczy lejek OD UŻYTKOWNIKÓW (nie sesji/eventów) — raport:
 *   dimensions: date × eventName × deviceCategory × newVsReturning
 *   metrics:    totalUsers (lejek) + eventCount (mikrokonwersje, „zdarzenia/tydz.")
 *
 * Trzymamy tylko eventy, których używa dashboard (lejek + 13 mikrokonwersji
 * z GTM-ROOM99) — reszta GA4 to szum.
 */
import { db as defaultDb, type DB } from '@/lib/db';
import { callMCPTool, connectMCP } from './mcp-client';
import { toNum, upsertGA4Funnel, type GA4FunnelRow } from './upsert';
import { type DateRange } from '@/lib/periods';

const MCP_URL = process.env.MCP_GA4_URL || 'https://mcp-analytics.up.railway.app/mcp';
const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '315856757';
const USER_ID = process.env.MCP_GA4_USER_ID || 'marcin@marketing-hackers.com';

/** Kroki lejka (architektura 22.04: Sesje → Wyświetlenie produktu → Koszyk → Checkout → Zakup). */
export const FUNNEL_EVENTS = [
  'session_start',
  'view_item',
  'add_to_cart',
  'begin_checkout',
  'purchase',
] as const;

/** Mikrokonwersje wdrożone przez GTM (kontener GTM-ROOM99-mikrokonwersje v2). */
export const MICRO_EVENTS = [
  'deep_engagement_120s',
  'view_item_qualified',
  'product_gallery_browse',
  'delivery_check_click',
  'product_inquiry_click',
  'review_engagement',
  'related_product_click',
  'filter_applied',
  'category_depth_2plus',
  'page_depth_4plus',
  'newsletter_signup',
  'scroll_75_product',
  'scroll_50_category',
] as const;

const TRACKED = new Set<string>([...FUNNEL_EVENTS, ...MICRO_EVENTS]);

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

function normalizeDevice(s: string | undefined): string {
  const v = (s ?? '').toLowerCase();
  if (v === 'mobile' || v === 'desktop' || v === 'tablet') return v;
  return 'other';
}

function normalizeUserType(s: string | undefined): string {
  const v = (s ?? '').toLowerCase();
  if (v === 'new') return 'new';
  if (v === 'returning') return 'returning';
  return 'unknown';
}

export async function syncGA4Funnel(
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
        dimensions: ['date', 'eventName', 'deviceCategory', 'newVsReturning'],
        metrics: ['totalUsers', 'eventCount'],
        limit: 100_000,
      },
      { retries: 2, initialBackoffMs: 1000, timeoutMs: 60_000 }
    );

    const raw: GA4ReportRow[] = Array.isArray(resp) ? resp : resp.rows ?? resp.data ?? [];

    const rows: GA4FunnelRow[] = [];
    for (const r of raw) {
      const dimMap = r.dimensions ?? null;
      const metMap = r.metrics ?? null;
      const dimVals = r.dimensionValues?.map((d) => d.value) ?? [];
      const metVals = r.metricValues?.map((m) => m.value) ?? [];
      const get = (key: string, idx: number) => dimMap?.[key] ?? dimVals[idx] ?? undefined;
      const getMetric = (key: string, idx: number) => metMap?.[key] ?? metVals[idx] ?? undefined;

      const date = normalizeDate(get('date', 0));
      const eventName = get('eventName', 1);
      if (!date || !eventName || !TRACKED.has(eventName)) continue;

      rows.push({
        date,
        eventName,
        device: normalizeDevice(get('deviceCategory', 2)),
        userType: normalizeUserType(get('newVsReturning', 3)),
        users: Math.round(toNum(getMetric('totalUsers', 0))),
        eventCount: Math.round(toNum(getMetric('eventCount', 1))),
      });
    }

    const rowsWritten = await upsertGA4Funnel(database, rows);
    return { rowsWritten };
  } finally {
    await client.close().catch(() => {});
  }
}
