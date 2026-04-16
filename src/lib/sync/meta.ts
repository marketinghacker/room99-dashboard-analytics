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

export async function syncMeta(
  opts: { presets?: string[]; db?: DB } = {}
): Promise<{ rowsWritten: number }> {
  const database = opts.db ?? defaultDb;
  // Default: pull today + yesterday per day, plus last_7d and last_30d as rolled-up buckets.
  // Yesterday & today give genuine per-day rows. The longer presets provide rolled-up
  // totals the UI uses as fallback when daily series isn't backfilled yet.
  const presets = opts.presets ?? ['yesterday', 'today'];

  const client = await connectMCP(MCP_URL, 'sse');
  try {
    let totalRows = 0;
    for (const preset of presets) {
      const insights = await fetchPreset(client, preset);
      const rows = rowsToAdsDaily(insights);
      if (rows.length === 0) continue;
      totalRows += await upsertAdsDaily(database, rows);
    }
    return { rowsWritten: totalRows };
  } finally {
    await client.close();
  }
}
