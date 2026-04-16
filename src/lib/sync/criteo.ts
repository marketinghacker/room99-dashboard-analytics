/**
 * Criteo sync: daily per-campaign stats via the MCP server.
 *
 * MCP server: https://mcp-criteo.up.railway.app/mcp  (SSE)
 * Tool: get_campaign_stats
 * Advertiser: 55483 (Room99)
 * Token auto-refreshed by the MCP server (15-min Criteo token TTL).
 */
import { db as defaultDb, type DB } from '@/lib/db';
import { callMCPTool, connectMCP } from './mcp-client';
import { toNum, toNumOrNull, upsertAdsDaily, type AdsDailyRow } from './upsert';
import { type DateRange } from '@/lib/periods';

const MCP_URL = process.env.MCP_CRITEO_URL || 'https://mcp-criteo.up.railway.app/mcp';
const ADVERTISER_ID = process.env.CRITEO_ADVERTISER_ID || '55483';

type CriteoRow = {
  Day?: string;
  CampaignId?: string | number;
  Campaign?: string;
  Clicks?: string | number;
  Displays?: string | number;
  AdvertiserCost?: string | number;
  Ctr?: string | number;
  Cpc?: string | number;
  Cpm?: string | number;
  SalesAllPc30d?: string | number;
  RevenueGeneratedPc30d?: string | number;
  ConversionRate?: string | number;
  RoasAllPc30d?: string | number;
};

export async function syncCriteo(
  range: DateRange,
  opts: { db?: DB } = {}
): Promise<{ rowsWritten: number }> {
  const database = opts.db ?? defaultDb;

  const client = await connectMCP(MCP_URL, 'sse');
  try {
    const resp = await callMCPTool<
      CriteoRow[] | {
        rows?: CriteoRow[];
        data?: CriteoRow[];
        Rows?: CriteoRow[];
        stats?: { Rows?: CriteoRow[] };
      }
    >(
      client,
      'get_campaign_stats',
      {
        advertiser_ids: [ADVERTISER_ID],
        start_date: range.start,
        end_date: range.end,
        dimensions: ['Day', 'CampaignId', 'Campaign'],
        // Criteo only exposes raw counts; we compute CTR/CPC/CPM/ROAS ourselves.
        metrics: ['Clicks', 'Displays', 'AdvertiserCost', 'SalesAllPc30d', 'RevenueGeneratedPc30d'],
        currency: 'PLN',
      },
      { retries: 3, initialBackoffMs: 1000 }
    );
    const raw: CriteoRow[] = Array.isArray(resp)
      ? resp
      : resp.stats?.Rows ?? resp.Rows ?? resp.rows ?? resp.data ?? [];

    const rows: AdsDailyRow[] = [];
    for (const r of raw) {
      const date = r.Day;
      const campaignId = r.CampaignId;
      if (!date || !campaignId) continue;
      const clicks = toNum(r.Clicks);
      const displays = toNum(r.Displays);
      const spend = toNum(r.AdvertiserCost);
      const ctr = displays > 0 ? clicks / displays : null;
      const cpc = clicks > 0 ? spend / clicks : null;
      const cpm = displays > 0 ? (spend / displays) * 1000 : null;
      rows.push({
        date: date.slice(0, 10),
        platform: 'criteo',
        accountId: ADVERTISER_ID,
        campaignId: String(campaignId),
        campaignName: r.Campaign ?? '',
        campaignStatus: null,
        campaignObjective: null,
        adGroupId: null,
        adGroupName: null,
        spend: String(spend),
        impressions: Math.round(displays),
        clicks: Math.round(clicks),
        ctr: ctr?.toString() ?? null,
        cpc: cpc?.toString() ?? null,
        cpm: cpm?.toString() ?? null,
        conversions: String(toNum(r.SalesAllPc30d)),
        conversionValue: String(toNum(r.RevenueGeneratedPc30d)),
      });
    }

    const rowsWritten = await upsertAdsDaily(database, rows);
    return { rowsWritten };
  } finally {
    await client.close();
  }
}
