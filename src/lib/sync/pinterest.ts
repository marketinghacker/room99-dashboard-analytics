/**
 * Pinterest adapter: Windsor.ai writes to `ad_performance_daily` directly.
 * This module READS that table and normalizes rows to the same shape as `ads_daily`
 * so the rollup job treats Pinterest identically to Meta/Google/Criteo.
 *
 * Numeric-looking TEXT columns (conversions, conversion_value, ctr, roas) are
 * coerced back to numbers with a safe fallback; missing conversion_value is
 * derived from ROAS × spend when possible (common Windsor quirk).
 */
import { db as defaultDb, type DB } from '@/lib/db';
import { and, eq, gte, lte } from 'drizzle-orm';
import { adPerformanceDaily } from '@/lib/schema';
import { type DateRange } from '@/lib/periods';
import { toNum, toNumOrNull, upsertAdsDaily, type AdsDailyRow } from './upsert';

export type NormalizedAdRow = {
  date: string;
  platform: 'pinterest';
  accountId: string;
  campaignId: string;
  campaignName: string;
  campaignStatus: string | null;
  campaignObjective: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  conversions: number;
  conversionValue: number;
};

export async function readPinterestRange(
  range: DateRange,
  opts: { db?: DB } = {}
): Promise<NormalizedAdRow[]> {
  const database = opts.db ?? defaultDb;

  const rows = await database
    .select()
    .from(adPerformanceDaily)
    .where(
      and(
        eq(adPerformanceDaily.datasource, 'pinterest'),
        gte(adPerformanceDaily.date, range.start),
        lte(adPerformanceDaily.date, range.end),
      ),
    );

  return rows.map<NormalizedAdRow>((r) => {
    const spend = toNum(r.spend);
    const impressions = Math.round(toNum(r.impressions));
    const clicks = Math.round(toNum(r.clicks));
    let conversions = toNum(r.conversions);
    let conversionValue = toNum(r.conversionValue);
    const roas = toNumOrNull(r.roas);

    // Fallback: some Windsor Pinterest rows have ROAS but empty conversion_value.
    if (conversionValue === 0 && roas != null && spend > 0) {
      conversionValue = roas * spend;
    }
    if (conversions === 0 && conversionValue > 0) {
      // leave conversions as 0 (Pinterest rarely reports conversions separately)
    }

    const ctr = impressions > 0 ? clicks / impressions : null;
    const cpc = clicks > 0 ? spend / clicks : null;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : null;

    return {
      date: (r.date ?? '').slice(0, 10),
      platform: 'pinterest',
      accountId: r.accountName ?? 'room99',
      campaignId: r.campaign ?? 'unknown',
      campaignName: r.campaign ?? '',
      campaignStatus: r.campaignStatus ?? null,
      campaignObjective: r.campaignObjective ?? null,
      spend,
      impressions,
      clicks,
      ctr,
      cpc,
      cpm,
      conversions,
      conversionValue,
    };
  }).filter((r) => r.date !== '');
}

/**
 * Mirrors Windsor Pinterest rows into `ads_daily` so the rollup reads from a
 * single source of truth. Uses the campaign name as a synthetic campaign_id
 * since Windsor's dump doesn't include Pinterest's numeric IDs.
 */
export async function syncPinterest(
  range: DateRange,
  opts: { db?: DB } = {}
): Promise<{ rowsWritten: number }> {
  const database = opts.db ?? defaultDb;
  const normalized = await readPinterestRange(range, { db: database });

  // Aggregate by (date, campaign_id) to avoid collisions when Windsor emits
  // multiple rows per campaign per day (one per ad_group etc.).
  const grouped = new Map<string, AdsDailyRow>();
  for (const r of normalized) {
    const key = `${r.date}|${r.campaignId}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.spend = String(Number(existing.spend) + r.spend);
      existing.impressions = (existing.impressions ?? 0) + r.impressions;
      existing.clicks = (existing.clicks ?? 0) + r.clicks;
      existing.conversions = String(Number(existing.conversions ?? 0) + r.conversions);
      existing.conversionValue = String(Number(existing.conversionValue ?? 0) + r.conversionValue);
    } else {
      grouped.set(key, {
        date: r.date,
        platform: 'pinterest',
        accountId: r.accountId,
        campaignId: r.campaignId,
        campaignName: r.campaignName,
        campaignStatus: r.campaignStatus,
        campaignObjective: r.campaignObjective,
        adGroupId: null,
        adGroupName: null,
        spend: String(r.spend),
        impressions: r.impressions,
        clicks: r.clicks,
        ctr: null,
        cpc: null,
        cpm: null,
        conversions: String(r.conversions),
        conversionValue: String(r.conversionValue),
      });
    }
  }

  // Recompute derived metrics after aggregation.
  const rows = Array.from(grouped.values()).map((r) => {
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

  const rowsWritten = await upsertAdsDaily(database, rows);
  return { rowsWritten };
}
