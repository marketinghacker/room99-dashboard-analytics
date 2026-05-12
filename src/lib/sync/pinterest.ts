/**
 * Pinterest Ads sync: daily per-campaign metrics via Pinterest API v5 (MCP).
 *
 * MCP server: https://mh-connector.up.railway.app/mcp  (streamable HTTP,
 *             gated by Bearer token = INTERNAL_API_SECRET set on the server).
 * Tools: list_campaigns + get_campaigns_analytics (granularity=DAY)
 * Ad account: 549764456968 (Room99 sp. z o.o., currency PLN)
 *
 * The MCP server stores the OAuth user token (encrypted) and refreshes it
 * automatically — we never see Pinterest's raw access token here. MCP-Pinterest
 * has no persistent "active user/account" state, so every call must pass
 * `user_id` and `ad_account_id` explicitly.
 *
 * Pinterest API quirks:
 *   - Money columns end in `_IN_MICRO_DOLLAR` — despite the name, the unit
 *     follows the ad account's currency (PLN for Room99). Divide by 1_000_000.
 *   - `TOTAL_CONVERSIONS_VALUE` doesn't exist — only per-event values
 *     (TOTAL_CHECKOUT_VALUE, TOTAL_SIGNUP_VALUE, …). We map purchase value
 *     from `TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR` and purchase count from
 *     `TOTAL_CHECKOUT`. This keeps `conversions` / `conversion_value` in
 *     `ads_daily` parallel with Meta and Google (purchases only, not the
 *     noisier all-events sum).
 *   - `get_campaigns_analytics` accepts at most 100 campaign_ids per call.
 *   - `list_campaigns` paginates via `bookmark` cursor (page_size ≤ 100).
 */
import { db as defaultDb, type DB } from '@/lib/db';
import { callMCPTool, connectMCP } from './mcp-client';
import { upsertAdsDaily, type AdsDailyRow } from './upsert';
import { type DateRange } from '@/lib/periods';

const MCP_URL = process.env.MCP_PINTEREST_URL || 'https://mh-connector.up.railway.app/mcp';
const MCP_TOKEN =
  process.env.MCP_PINTEREST_TOKEN ||
  process.env.MCP_PINTEREST_INTERNAL_SECRET ||
  process.env.PINTEREST_INTERNAL_SECRET ||
  '';
const USER_ID = process.env.MCP_PINTEREST_USER_ID || 'marcin@marketing-hackers.com';
const AD_ACCOUNT_ID = process.env.PINTEREST_AD_ACCOUNT_ID || '549764456968';

/** Pinterest reports money in 1/1_000_000 of the account currency (PLN micros). */
const MICRO = 1_000_000;

const ANALYTICS_COLUMNS = [
  'SPEND_IN_MICRO_DOLLAR',
  'IMPRESSION_1',
  'CLICKTHROUGH_1',
  'CTR',
  'CPC_IN_MICRO_DOLLAR',
  'CPM_IN_MICRO_DOLLAR',
  'TOTAL_CHECKOUT',
  'TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR',
] as const;

const CAMPAIGN_BATCH_SIZE = 100;
const LIST_PAGE_SIZE = 100;
const LIST_STATUSES = ['ACTIVE', 'PAUSED'];

export type Campaign = {
  id: string;
  name?: string;
  status?: string;
  objective_type?: string;
};

export type AnalyticsRow = {
  DATE?: string;
  CAMPAIGN_ID?: string | number;
  AD_ACCOUNT_ID?: string;
  SPEND_IN_MICRO_DOLLAR?: number;
  IMPRESSION_1?: number;
  CLICKTHROUGH_1?: number;
  CTR?: number;
  CPC_IN_MICRO_DOLLAR?: number;
  CPM_IN_MICRO_DOLLAR?: number;
  TOTAL_CHECKOUT?: number;
  TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR?: number;
};

type CampaignsList = {
  items?: Campaign[];
  campaigns?: Campaign[];
  bookmark?: string | null;
};

type AnalyticsResp =
  | AnalyticsRow[]
  | { analytics?: AnalyticsRow[] | { items?: AnalyticsRow[] }; data?: AnalyticsRow[]; rows?: AnalyticsRow[] };

type Client = Awaited<ReturnType<typeof connectMCP>>;

async function listAllCampaigns(client: Client): Promise<Campaign[]> {
  const all: Campaign[] = [];
  let bookmark: string | null | undefined;
  do {
    const resp = await callMCPTool<CampaignsList>(
      client,
      'list_campaigns',
      {
        user_id: USER_ID,
        ad_account_id: AD_ACCOUNT_ID,
        entity_statuses: LIST_STATUSES,
        page_size: LIST_PAGE_SIZE,
        ...(bookmark ? { bookmark } : {}),
      },
      { retries: 3, initialBackoffMs: 1000 },
    );
    const batch = resp.items ?? resp.campaigns ?? [];
    all.push(...batch);
    bookmark = resp.bookmark ?? null;
  } while (bookmark);
  return all;
}

async function fetchCampaignAnalytics(
  client: Client,
  campaignIds: string[],
  range: DateRange,
): Promise<AnalyticsRow[]> {
  const out: AnalyticsRow[] = [];
  for (let i = 0; i < campaignIds.length; i += CAMPAIGN_BATCH_SIZE) {
    const batch = campaignIds.slice(i, i + CAMPAIGN_BATCH_SIZE);
    const resp = await callMCPTool<AnalyticsResp>(
      client,
      'get_campaigns_analytics',
      {
        user_id: USER_ID,
        ad_account_id: AD_ACCOUNT_ID,
        campaign_ids: batch,
        start_date: range.start,
        end_date: range.end,
        granularity: 'DAY',
        columns: [...ANALYTICS_COLUMNS],
      },
      { retries: 3, initialBackoffMs: 1000, timeoutMs: 120_000 },
    );
    const inner = Array.isArray(resp) ? resp : resp.analytics ?? resp.data ?? resp.rows;
    const rows = Array.isArray(inner) ? inner : inner?.items ?? [];
    out.push(...rows);
  }
  return out;
}

/**
 * Exported for unit testing. Pure transformation from Pinterest analytics rows
 * to AdsDailyRow shape. Aggregates defensively per (date, campaign_id) — at
 * DAY granularity Pinterest already returns one row per pair, but we tolerate
 * the MCP layer ever splitting a campaign-day (e.g. attribution-window slicing).
 */
export function buildAdsDailyRows(
  analytics: AnalyticsRow[],
  campaignsById: Map<string, Campaign>,
): AdsDailyRow[] {
  const grouped = new Map<string, AdsDailyRow>();
  for (const r of analytics) {
    const date = (r.DATE ?? '').slice(0, 10);
    const campaignId = r.CAMPAIGN_ID == null ? '' : String(r.CAMPAIGN_ID);
    if (!date || !campaignId) continue;

    const meta = campaignsById.get(campaignId);
    const spend = (r.SPEND_IN_MICRO_DOLLAR ?? 0) / MICRO;
    const impressions = Math.round(r.IMPRESSION_1 ?? 0);
    const clicks = Math.round(r.CLICKTHROUGH_1 ?? 0);
    const conversions = r.TOTAL_CHECKOUT ?? 0;
    const conversionValue = (r.TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR ?? 0) / MICRO;

    const key = `${date}|${campaignId}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.spend = (Number(existing.spend) + spend).toFixed(4);
      existing.impressions = (existing.impressions ?? 0) + impressions;
      existing.clicks = (existing.clicks ?? 0) + clicks;
      existing.conversions = String(Number(existing.conversions ?? 0) + conversions);
      existing.conversionValue = (Number(existing.conversionValue ?? 0) + conversionValue).toFixed(4);
    } else {
      grouped.set(key, {
        date,
        platform: 'pinterest',
        accountId: r.AD_ACCOUNT_ID ?? AD_ACCOUNT_ID,
        campaignId,
        campaignName: meta?.name ?? campaignId,
        campaignStatus: meta?.status ?? null,
        campaignObjective: meta?.objective_type ?? null,
        adGroupId: null,
        adGroupName: null,
        spend: spend.toFixed(4),
        impressions,
        clicks,
        ctr: null,
        cpc: null,
        cpm: null,
        conversions: String(conversions),
        conversionValue: conversionValue.toFixed(4),
      });
    }
  }

  // Recompute derived metrics from aggregated totals so they stay consistent
  // even if Pinterest pre-rounds CTR/CPC/CPM at row level.
  return Array.from(grouped.values()).map((r) => {
    const imp = r.impressions ?? 0;
    const clk = r.clicks ?? 0;
    const sp = Number(r.spend);
    return {
      ...r,
      ctr: imp > 0 ? (clk / imp).toString() : null,
      cpc: clk > 0 ? (sp / clk).toString() : null,
      cpm: imp > 0 ? ((sp / imp) * 1000).toString() : null,
    };
  });
}

export async function syncPinterest(
  range: DateRange,
  opts: { db?: DB } = {},
): Promise<{ rowsWritten: number }> {
  const database = opts.db ?? defaultDb;
  if (!MCP_TOKEN) throw new Error('MCP_PINTEREST_TOKEN missing — add to Railway Variables');
  console.log(`[pinterest] ad_account=${AD_ACCOUNT_ID}, range=${range.start}..${range.end}`);

  const client = await connectMCP(MCP_URL, 'http', { token: MCP_TOKEN });
  try {
    const campaigns = await listAllCampaigns(client);
    if (campaigns.length === 0) {
      console.log('[pinterest] no campaigns found, skipping');
      return { rowsWritten: 0 };
    }

    const campaignsById = new Map<string, Campaign>(
      campaigns.map((c) => [String(c.id), c]),
    );
    const campaignIds = campaigns.map((c) => String(c.id));

    const analytics = await fetchCampaignAnalytics(client, campaignIds, range);
    const rows = buildAdsDailyRows(analytics, campaignsById);
    const rowsWritten = await upsertAdsDaily(database, rows);
    console.log(`[pinterest] wrote ${rowsWritten} rows across ${campaigns.length} campaigns`);
    return { rowsWritten };
  } finally {
    await client.close();
  }
}
