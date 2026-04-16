/**
 * Google Ads sync: daily per-campaign metrics via GAQL.
 *
 * MCP server: https://google-ads-mcp-server-production-7a5f.up.railway.app/mcp  (streamable HTTP)
 * Tool: google_ads_run_query — arbitrary GAQL.
 * Customer: 1331139339 (Room99)
 */
import { db as defaultDb, type DB } from '@/lib/db';
import { callMCPTool, connectMCP } from './mcp-client';
import { toNum, toNumOrNull, upsertAdsDaily, type AdsDailyRow } from './upsert';
import { type DateRange } from '@/lib/periods';

const MCP_URL =
  process.env.MCP_GOOGLE_ADS_URL ||
  'https://google-ads-mcp-server-production-7a5f.up.railway.app/mcp';
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID || '1331139339';

type GAQLRow = {
  campaign?: { id?: string | number; name?: string; status?: string; advertising_channel_type?: string };
  segments?: { date?: string };
  metrics?: {
    cost_micros?: string | number;
    impressions?: string | number;
    clicks?: string | number;
    ctr?: string | number;
    average_cpc?: string | number;
    average_cpm?: string | number;
    conversions?: string | number;
    conversions_value?: string | number;
  };
};

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function splitRange(range: DateRange, chunkDays: number): DateRange[] {
  const out: DateRange[] = [];
  let cursor = range.start;
  while (cursor <= range.end) {
    const chunkEnd = addDaysISO(cursor, chunkDays - 1);
    out.push({ start: cursor, end: chunkEnd > range.end ? range.end : chunkEnd });
    cursor = addDaysISO(chunkEnd, 1);
  }
  return out;
}

function buildRowsFromGAQL(raw: GAQLRow[]): AdsDailyRow[] {
  const rows: AdsDailyRow[] = [];
  for (const r of raw) {
    // GAQL responses may come in nested or flattened form depending on MCP server impl.
    const flat = r as unknown as Record<string, unknown>;
    const date =
      (r.segments?.date as string | undefined) ??
      (flat.segments_date as string | undefined);
    const campaignId =
      r.campaign?.id ??
      (flat.campaign_id as string | number | undefined);
    if (!date || !campaignId) continue;
    const m = r.metrics ?? {};
    const costMicros = toNum((m.cost_micros ?? flat.metrics_cost_micros) as unknown);
    rows.push({
      date,
      platform: 'google_ads',
      accountId: CUSTOMER_ID,
      campaignId: String(campaignId),
      campaignName: String(r.campaign?.name ?? flat.campaign_name ?? ''),
      campaignStatus: (r.campaign?.status ?? flat.campaign_status) as string | null,
      campaignObjective: (r.campaign?.advertising_channel_type ?? flat.campaign_advertising_channel_type) as string | null,
      adGroupId: null,
      adGroupName: null,
      spend: String(costMicros / 1_000_000),
      impressions: Math.round(toNum((m.impressions ?? flat.metrics_impressions) as unknown)),
      clicks: Math.round(toNum((m.clicks ?? flat.metrics_clicks) as unknown)),
      ctr: toNumOrNull((m.ctr ?? flat.metrics_ctr) as unknown)?.toString() ?? null,
      // average_cpc & average_cpm are returned in MICROS → convert to account currency.
      cpc: (() => {
        const v = toNumOrNull((m.average_cpc ?? flat.metrics_average_cpc) as unknown);
        return v == null ? null : (v / 1_000_000).toString();
      })(),
      cpm: (() => {
        const v = toNumOrNull((m.average_cpm ?? flat.metrics_average_cpm) as unknown);
        return v == null ? null : (v / 1_000_000).toString();
      })(),
      conversions: String(toNum((m.conversions ?? flat.metrics_conversions) as unknown)),
      conversionValue: String(toNum((m.conversions_value ?? flat.metrics_conversions_value) as unknown)),
    });
  }
  return rows;
}

export async function syncGoogleAds(
  range: DateRange,
  opts: { db?: DB; chunkDays?: number } = {}
): Promise<{ rowsWritten: number }> {
  const database = opts.db ?? defaultDb;
  const chunkDays = opts.chunkDays ?? 7; // avoid 200k char truncation per chunk

  console.log(`[google-ads] customer_id=${CUSTOMER_ID}, range=${range.start}..${range.end}`);
  const client = await connectMCP(MCP_URL, 'http');
  try {
    let totalWritten = 0;
    for (const chunk of splitRange(range, chunkDays)) {
      const query = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.advertising_channel_type,
          segments.date,
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.average_cpm,
          metrics.conversions,
          metrics.conversions_value
        FROM campaign
        WHERE segments.date BETWEEN '${chunk.start}' AND '${chunk.end}'
      `.trim();

      const resp = await callMCPTool<GAQLRow[] | { results?: GAQLRow[]; rows?: GAQLRow[] }>(
        client,
        'google_ads_run_query',
        { customer_id: CUSTOMER_ID, query },
        { retries: 3, initialBackoffMs: 1000 }
      );
      const raw = Array.isArray(resp) ? resp : resp.results ?? resp.rows ?? [];
      const rows = buildRowsFromGAQL(raw);
      totalWritten += await upsertAdsDaily(database, rows);
    }
    return { rowsWritten: totalWritten };
  } finally {
    await client.close();
  }
}
