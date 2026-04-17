/**
 * Meta Ads sync: fetches per-campaign insights via the MCP server.
 *
 * MCP server: https://mcp-meta.up.railway.app/mcp  (SSE transport)
 * Tool: get_insights, level="campaign"
 *
 * LIMITATION: The MCP server only exposes `date_preset` (today, yesterday, last_7d,
 * last_30d...) — not per-day `time_increment`. So we call multiple presets back-to-back
 * and store each as aggregate with the preset's end date. For the "yesterday" preset
 * we get genuine single-day per-campaign data; for longer presets we store rolled-up
 * rows tagged at their end date.
 *
 * Account: act_295812916 (Room99) — override with META_ACCOUNT_ID.
 */
import { sql } from 'drizzle-orm';
import { db as defaultDb, type DB } from '@/lib/db';
import { callMCPTool, connectMCP } from './mcp-client';
import { toNum, toNumOrNull, upsertAdsDaily, type AdsDailyRow } from './upsert';

const MCP_URL = process.env.MCP_META_ADS_URL || 'https://mcp-meta.up.railway.app/mcp';
const ACCOUNT_ID = process.env.META_ACCOUNT_ID || 'act_295812916';

type MetaInsightRow = {
  campaign_id?: string;
  campaign_name?: string;
  date_start?: string;
  date_stop?: string;
  spend?: string | number;
  impressions?: string | number;
  clicks?: string | number;
  ctr?: string | number;
  cpc?: string | number;
  cpm?: string | number;
  actions?: Array<{ action_type: string; value: string | number }>;
  action_values?: Array<{ action_type: string; value: string | number }>;
};

const PURCHASE_ACTIONS = new Set([
  'purchase',
  'offsite_conversion.fb_pixel_purchase',
  'omni_purchase',
]);

function extractPurchase(row: MetaInsightRow): { conversions: number; conversionValue: number } {
  const convRow = row.actions?.find((a) => PURCHASE_ACTIONS.has(a.action_type));
  const valRow = row.action_values?.find((a) => PURCHASE_ACTIONS.has(a.action_type));
  return {
    conversions: toNum(convRow?.value),
    conversionValue: toNum(valRow?.value),
  };
}

async function fetchPreset(
  client: Awaited<ReturnType<typeof connectMCP>>,
  datePreset: string
): Promise<MetaInsightRow[]> {
  const resp = await callMCPTool<{ data?: MetaInsightRow[]; insights?: MetaInsightRow[] } | MetaInsightRow[]>(
    client,
    'get_insights',
    {
      account_id: ACCOUNT_ID,
      level: 'campaign',
      date_preset: datePreset,
      fields: [
        'campaign_id', 'campaign_name',
        'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm',
        'actions', 'action_values',
        'date_start', 'date_stop',
      ],
      limit: 5000,
    },
    { retries: 3, initialBackoffMs: 1000 }
  );
  return Array.isArray(resp) ? resp : resp.data ?? resp.insights ?? [];
}

function rowsToAdsDaily(rows: MetaInsightRow[]): AdsDailyRow[] {
  const out: AdsDailyRow[] = [];
  for (const r of rows) {
    const date = r.date_stop ?? r.date_start;
    if (!date || !r.campaign_id) continue;
    const purchase = extractPurchase(r);
    out.push({
      date,
      platform: 'meta',
      accountId: ACCOUNT_ID,
      campaignId: String(r.campaign_id),
      campaignName: r.campaign_name ?? '',
      campaignStatus: null,
      campaignObjective: null,
      adGroupId: null,
      adGroupName: null,
      spend: String(toNum(r.spend)),
      impressions: Math.round(toNum(r.impressions)),
      clicks: Math.round(toNum(r.clicks)),
      ctr: toNumOrNull(r.ctr)?.toString() ?? null,
      cpc: toNumOrNull(r.cpc)?.toString() ?? null,
      cpm: toNumOrNull(r.cpm)?.toString() ?? null,
      conversions: String(purchase.conversions),
      conversionValue: String(purchase.conversionValue),
    });
  }
  return out;
}

type MetaPreset = 'today' | 'yesterday' | 'this_month' | 'last_month' | 'last_7d' | 'last_30d';

/**
 * Compute the (start, end, days) window a preset covers, using `now` as reference.
 * Meta MCP returns aggregates; we spread them back across their range so SUM
 * over any sub-range returns accurate totals.
 */
function resolveMetaPresetRange(preset: MetaPreset, now = new Date()): { start: string; end: string; days: number } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  switch (preset) {
    case 'today':
      return { start: iso(today), end: iso(today), days: 1 };
    case 'yesterday':
      return { start: iso(yesterday), end: iso(yesterday), days: 1 };
    case 'this_month': {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      const days = Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1;
      return { start: iso(start), end: iso(today), days };
    }
    case 'last_month': {
      const firstOfThis = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      const lastPrev = new Date(firstOfThis);
      lastPrev.setUTCDate(lastPrev.getUTCDate() - 1);
      const firstPrev = new Date(Date.UTC(lastPrev.getUTCFullYear(), lastPrev.getUTCMonth(), 1));
      const days = Math.round((lastPrev.getTime() - firstPrev.getTime()) / 86_400_000) + 1;
      return { start: iso(firstPrev), end: iso(lastPrev), days };
    }
    case 'last_7d': {
      const end = yesterday;
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 6);
      return { start: iso(start), end: iso(end), days: 7 };
    }
    case 'last_30d': {
      const end = yesterday;
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 29);
      return { start: iso(start), end: iso(end), days: 30 };
    }
  }
}

function spreadAcrossRange(
  rows: MetaInsightRow[],
  range: { start: string; end: string; days: number },
): AdsDailyRow[] {
  if (rows.length === 0) return [];

  // Generate the list of ISO dates in the range.
  const dates: string[] = [];
  const cursor = new Date(range.start + 'T00:00:00Z');
  const end = new Date(range.end + 'T00:00:00Z');
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const n = dates.length;

  const out: AdsDailyRow[] = [];
  for (const r of rows) {
    if (!r.campaign_id) continue;
    const spend = toNum(r.spend);
    const impressions = toNum(r.impressions);
    const clicks = toNum(r.clicks);
    const purchase = extractPurchase(r);

    for (const iso of dates) {
      out.push({
        date: iso,
        platform: 'meta',
        accountId: ACCOUNT_ID,
        campaignId: String(r.campaign_id),
        campaignName: r.campaign_name ?? '',
        campaignStatus: null,
        campaignObjective: null,
        adGroupId: null,
        adGroupName: null,
        spend: (spend / n).toFixed(4),
        impressions: Math.round(impressions / n),
        clicks: Math.round(clicks / n),
        ctr: impressions > 0 ? (clicks / impressions).toString() : null,
        cpc: clicks > 0 ? (spend / clicks).toString() : null,
        cpm: impressions > 0 ? ((spend / impressions) * 1000).toString() : null,
        conversions: (purchase.conversions / n).toFixed(4),
        conversionValue: (purchase.conversionValue / n).toFixed(4),
      });
    }
  }
  return out;
}

/**
 * Default Meta sync fetches TWO presets: `this_month` + `last_month`.
 * Each spreads aggregate evenly across that month's days, so any range query
 * within those two months returns accurate totals.
 *
 * Trade-off: the daily chart for Meta is "stair-flat" — same value each day
 * within a preset bucket. True daily would need direct Facebook Graph API access.
 * GA4 + SellRocket provide real daily granularity.
 */
export async function syncMeta(
  opts: { preset?: MetaPreset; presets?: MetaPreset[]; db?: DB } = {}
): Promise<{ rowsWritten: number }> {
  const database = opts.db ?? defaultDb;
  const presets: MetaPreset[] = opts.presets ?? (opts.preset ? [opts.preset] : ['this_month', 'last_month']);

  const client = await connectMCP(MCP_URL, 'sse');
  try {
    let totalRows = 0;
    let deletedFor: Array<{ start: string; end: string }> = [];
    for (const preset of presets) {
      const range = resolveMetaPresetRange(preset);
      const insights = await fetchPreset(client, preset);
      const rows = spreadAcrossRange(insights, range);
      if (rows.length === 0) continue;

      // Replace this preset's window fully. Avoid double-counting overlapping
      // presets by tracking which windows we've already cleared.
      const overlap = deletedFor.some((d) => d.start === range.start && d.end === range.end);
      if (!overlap) {
        await database.execute(
          sql`DELETE FROM ads_daily WHERE platform='meta' AND date BETWEEN ${range.start} AND ${range.end}`
        );
        deletedFor.push({ start: range.start, end: range.end });
      }
      totalRows += await upsertAdsDaily(database, rows);
    }
    return { rowsWritten: totalRows };
  } finally {
    await client.close();
  }
}
