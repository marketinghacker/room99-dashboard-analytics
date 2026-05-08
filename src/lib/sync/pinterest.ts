/**
 * Pinterest sync: live per-campaign daily metrics via the MCP-Pinterest server.
 *
 * MCP server: https://mh-connector.up.railway.app/mcp  (streamable HTTP, gated by
 *             Bearer token = INTERNAL_API_SECRET set on the MCP server itself).
 * Tools: list_campaigns + get_campaigns_analytics
 * Ad account: 549764456968 (Room99 sp. z o.o., currency PLN)
 *
 * The MCP server stores the OAuth user token (encrypted) and refreshes it
 * automatically — we never see Pinterest's raw access token here. Spend is
 * reported in `*_IN_MICRO_DOLLAR` columns; despite the name the unit follows
 * the ad account's currency (PLN for Room99).
 *
 * Replaces the legacy Windsor.ai reader (preserved in pinterest-windsor.ts)
 * which lagged 24-48h and dropped fields.
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
// MCP-Pinterest dropped persistent 'active user' state (multi-tenant safety),
// so every call must pass user_id explicitly.
const USER_ID = process.env.MCP_PINTEREST_USER_ID || 'marcin@marketing-hackers.com';
const AD_ACCOUNT_ID = process.env.PINTEREST_AD_ACCOUNT_ID || '549764456968';

/** Pinterest reports money in 1/1_000_000 of the account currency. */
const MICRO = 1_000_000;

type CampaignsList = {
  items?: Array<{ id: string; name: string; status?: string; objective_type?: string }>;
  campaigns?: Array<{ id: string; name: string; status?: string; objective_type?: string }>;
};

type AnalyticsRow = {
  CAMPAIGN_ID?: string | number;
  AD_ACCOUNT_ID?: string;
  DATE?: string;
  SPEND_IN_MICRO_DOLLAR?: number;
  IMPRESSION_1?: number;
  CLICKTHROUGH_1?: number;
  CTR?: number;
  CPC_IN_MICRO_DOLLAR?: number;
  TOTAL_CHECKOUT?: number;
  TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR?: number;
};

type AnalyticsResp =
  | AnalyticsRow[]
  | { analytics?: AnalyticsRow[]; data?: AnalyticsRow[]; rows?: AnalyticsRow[] };

export async function syncPinterest(
  range: DateRange,
  opts: { db?: DB } = {}
): Promise<{ rowsWritten: number }> {
  const database = opts.db ?? defaultDb;
  if (!MCP_TOKEN) throw new Error('MCP_PINTEREST_TOKEN missing — add to Railway Variables');

  const client = await connectMCP(MCP_URL, 'http', { token: MCP_TOKEN });
  try {
    // 1) Find all campaigns we should pull analytics for. Include both ACTIVE
    //    and PAUSED — paused campaigns may still have spend on the requested
    //    range (e.g. paused yesterday, ran on May 4).
    const campaigns = await callMCPTool<CampaignsList>(
      client,
      'list_campaigns',
      {
        user_id: USER_ID,
        ad_account_id: AD_ACCOUNT_ID,
        entity_statuses: ['ACTIVE', 'PAUSED'],
        page_size: 100,
      },
      { retries: 3, initialBackoffMs: 1000 },
    );
    const list = campaigns.items ?? campaigns.campaigns ?? [];
    if (list.length === 0) {
      console.log('[pinterest] no campaigns found, skipping');
      return { rowsWritten: 0 };
    }

    const idToMeta = new Map(list.map((c) => [String(c.id), c]));
    const campaignIds = [...idToMeta.keys()];

    // 2) Pull DAY-granular analytics for the campaigns. Pinterest caps at 100
    //    campaign IDs per call — chunk if needed.
    const all: AnalyticsRow[] = [];
    const CHUNK = 100;
    for (let i = 0; i < campaignIds.length; i += CHUNK) {
      const slice = campaignIds.slice(i, i + CHUNK);
      const resp = await callMCPTool<AnalyticsResp>(
        client,
        'get_campaigns_analytics',
        {
          user_id: USER_ID,
          ad_account_id: AD_ACCOUNT_ID,
          campaign_ids: slice,
          start_date: range.start,
          end_date: range.end,
          granularity: 'DAY',
          columns: [
            'SPEND_IN_MICRO_DOLLAR',
            'IMPRESSION_1',
            'CLICKTHROUGH_1',
            'CTR',
            'CPC_IN_MICRO_DOLLAR',
            'TOTAL_CHECKOUT',
            'TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR',
          ],
        },
        { retries: 3, initialBackoffMs: 1000, timeoutMs: 120_000 },
      );
      const rows = Array.isArray(resp)
        ? resp
        : resp.analytics ?? resp.data ?? resp.rows ?? [];
      all.push(...rows);
    }

    // 3) Map → AdsDailyRow. Skip rows without date or campaign id.
    const adsRows: AdsDailyRow[] = [];
    for (const r of all) {
      const date = (r.DATE ?? '').slice(0, 10);
      const campaignId = r.CAMPAIGN_ID == null ? '' : String(r.CAMPAIGN_ID);
      if (!date || !campaignId) continue;
      const meta = idToMeta.get(campaignId);
      const spend = (r.SPEND_IN_MICRO_DOLLAR ?? 0) / MICRO;
      const impressions = Math.round(r.IMPRESSION_1 ?? 0);
      const clicks = Math.round(r.CLICKTHROUGH_1 ?? 0);
      const ctr = impressions > 0 ? clicks / impressions : null;
      const cpc = clicks > 0 ? spend / clicks : null;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : null;
      // TOTAL_CHECKOUT = real purchase events, matches "transactions" semantics
      // we use for Meta/Google. TOTAL_CONVERSIONS includes view-through visits
      // and is too noisy to compare cross-platform.
      const conversions = r.TOTAL_CHECKOUT ?? 0;
      const conversionValue = (r.TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR ?? 0) / MICRO;

      adsRows.push({
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
        ctr: ctr?.toString() ?? null,
        cpc: cpc?.toString() ?? null,
        cpm: cpm?.toString() ?? null,
        conversions: String(conversions),
        conversionValue: conversionValue.toFixed(4),
      });
    }

    const rowsWritten = await upsertAdsDaily(database, adsRows);
    console.log(`[pinterest] wrote ${rowsWritten} rows for ${range.start}..${range.end} across ${list.length} campaigns`);
    return { rowsWritten };
  } finally {
    await client.close();
  }
}
