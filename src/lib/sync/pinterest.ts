/**
 * Pinterest Ads sync: daily per-campaign metrics via Pinterest API v5 (MCP).
 *
 * MCP server: https://mh-connector.up.railway.app/mcp  (streamable HTTP)
 * Tools: list_campaigns + get_campaigns_analytics (granularity=DAY)
 * Ad account: 549764456968 (Room99)
 *
 * Pinterest API quirks:
 *   - Money columns end in `_IN_MICRO_DOLLAR` and are returned as native account
 *     currency × 1_000_000 (account=PLN, so divide by 1M to get PLN).
 *   - `TOTAL_CONVERSIONS_VALUE` doesn't exist on Pinterest — only per-event values
 *     (TOTAL_CHECKOUT_VALUE, TOTAL_SIGNUP_VALUE, …). We map purchase value from
 *     `TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR` to stay parallel with Meta/Google
 *     which surface purchase value in `conversion_value`.
 *   - `get_campaigns_analytics` accepts at most 100 campaign_ids per call.
 *   - `list_campaigns` paginates via `bookmark` cursor (page_size ≤ 100).
 */
import { db as defaultDb, type DB } from '@/lib/db';
import { callMCPTool, connectMCP } from './mcp-client';
import { upsertAdsDaily, type AdsDailyRow } from './upsert';
import { type DateRange } from '@/lib/periods';

const MCP_URL = process.env.MCP_PINTEREST_URL || 'https://mh-connector.up.railway.app/mcp';
const AD_ACCOUNT_ID = process.env.PINTEREST_AD_ACCOUNT_ID || '549764456968';
const USER_ID = process.env.MCP_PINTEREST_USER_ID || 'marcin@marketing-hackers.com';

const ANALYTICS_COLUMNS = [
  'CAMPAIGN_ID',
  'CAMPAIGN_NAME',
  'CAMPAIGN_ENTITY_STATUS',
  'CAMPAIGN_OBJECTIVE_TYPE',
  'SPEND_IN_MICRO_DOLLAR',
  'IMPRESSION_1',
  'CLICKTHROUGH_1',
  'CTR',
  'CPC_IN_MICRO_DOLLAR',
  'CPM_IN_MICRO_DOLLAR',
  'TOTAL_CONVERSIONS',
  'TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR',
] as const;

const CAMPAIGN_BATCH_SIZE = 100;
const LIST_PAGE_SIZE = 100;
const LIST_STATUSES = ['ACTIVE', 'PAUSED', 'ARCHIVED'];

type Campaign = {
  id: string;
  name?: string;
  status?: string;
  objective_type?: string;
};

type AnalyticsRow = {
  DATE: string;
  CAMPAIGN_ID: string | number;
  CAMPAIGN_NAME?: string;
  CAMPAIGN_ENTITY_STATUS?: string;
  CAMPAIGN_OBJECTIVE_TYPE?: string;
  SPEND_IN_MICRO_DOLLAR?: number;
  IMPRESSION_1?: number;
  CLICKTHROUGH_1?: number;
  CTR?: number;
  CPC_IN_MICRO_DOLLAR?: number;
  CPM_IN_MICRO_DOLLAR?: number;
  TOTAL_CONVERSIONS?: number;
  TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR?: number;
};

type ListCampaignsResp = {
  campaigns?: Campaign[];
  bookmark?: string | null;
  count?: number;
};

type AnalyticsResp = {
  analytics?: AnalyticsRow[] | { items?: AnalyticsRow[] };
  campaign_ids?: string[];
};

type Client = Awaited<ReturnType<typeof connectMCP>>;

const microsToUnit = (v: number | undefined): number =>
  v == null ? 0 : v / 1_000_000;

const microsToString = (v: number | undefined): string => String(microsToUnit(v));

async function listAllCampaigns(client: Client): Promise<Campaign[]> {
  const all: Campaign[] = [];
  let bookmark: string | null | undefined;
  do {
    const resp = await callMCPTool<ListCampaignsResp>(
      client,
      'list_campaigns',
      {
        ad_account_id: AD_ACCOUNT_ID,
        page_size: LIST_PAGE_SIZE,
        entity_statuses: LIST_STATUSES,
        ...(bookmark ? { bookmark } : {}),
        user_id: USER_ID,
      },
      { retries: 3, initialBackoffMs: 1000 },
    );
    const batch = resp.campaigns ?? [];
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
    const resp = await callMCPTool<AnalyticsResp | AnalyticsRow[]>(
      client,
      'get_campaigns_analytics',
      {
        ad_account_id: AD_ACCOUNT_ID,
        campaign_ids: batch,
        start_date: range.start,
        end_date: range.end,
        granularity: 'DAY',
        columns: [...ANALYTICS_COLUMNS],
        user_id: USER_ID,
      },
      { retries: 3, initialBackoffMs: 1000, timeoutMs: 60_000 },
    );
    const inner = Array.isArray(resp) ? resp : resp.analytics;
    const rows = Array.isArray(inner) ? inner : inner?.items ?? [];
    out.push(...rows);
  }
  return out;
}

export function buildAdsDailyRows(
  analytics: AnalyticsRow[],
  campaignsById: Map<string, Campaign>,
): AdsDailyRow[] {
  // Pinterest returns one row per (DATE, CAMPAIGN_ID) at DAY granularity, but
  // we still aggregate defensively in case the MCP layer ever splits a
  // campaign-day across multiple rows (e.g. attribution-window slicing).
  const grouped = new Map<string, AdsDailyRow>();
  for (const r of analytics) {
    const date = r.DATE?.slice(0, 10);
    const campaignId = r.CAMPAIGN_ID == null ? '' : String(r.CAMPAIGN_ID);
    if (!date || !campaignId) continue;

    const known = campaignsById.get(campaignId);
    const spend = microsToUnit(r.SPEND_IN_MICRO_DOLLAR);
    const impressions = Math.round(r.IMPRESSION_1 ?? 0);
    const clicks = Math.round(r.CLICKTHROUGH_1 ?? 0);
    const conversions = r.TOTAL_CONVERSIONS ?? 0;
    const conversionValue = microsToUnit(r.TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR);

    const key = `${date}|${campaignId}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.spend = String(Number(existing.spend) + spend);
      existing.impressions = (existing.impressions ?? 0) + impressions;
      existing.clicks = (existing.clicks ?? 0) + clicks;
      existing.conversions = String(Number(existing.conversions ?? 0) + conversions);
      existing.conversionValue = String(Number(existing.conversionValue ?? 0) + conversionValue);
    } else {
      grouped.set(key, {
        date,
        platform: 'pinterest',
        accountId: AD_ACCOUNT_ID,
        campaignId,
        campaignName: r.CAMPAIGN_NAME ?? known?.name ?? '',
        campaignStatus: r.CAMPAIGN_ENTITY_STATUS ?? known?.status ?? null,
        campaignObjective: r.CAMPAIGN_OBJECTIVE_TYPE ?? known?.objective_type ?? null,
        adGroupId: null,
        adGroupName: null,
        spend: String(spend),
        impressions,
        clicks,
        ctr: null,
        cpc: null,
        cpm: null,
        conversions: String(conversions),
        conversionValue: String(conversionValue),
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
  console.log(`[pinterest] ad_account=${AD_ACCOUNT_ID}, range=${range.start}..${range.end}`);

  const client = await connectMCP(MCP_URL, 'http');
  try {
    const campaigns = await listAllCampaigns(client);
    if (campaigns.length === 0) return { rowsWritten: 0 };

    const campaignsById = new Map<string, Campaign>(
      campaigns.map((c) => [String(c.id), c]),
    );
    const campaignIds = campaigns.map((c) => String(c.id));

    const analytics = await fetchCampaignAnalytics(client, campaignIds, range);
    const rows = buildAdsDailyRows(analytics, campaignsById);
    return { rowsWritten: await upsertAdsDaily(database, rows) };
  } finally {
    await client.close();
  }
}
