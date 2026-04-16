/**
 * Upsert helpers for the 5-minute chunks of ads_daily / ga4_daily.
 * Drizzle doesn't expose `ON CONFLICT` as a single call when the target is a composite PK,
 * so these use `onConflictDoUpdate`.
 */
import { sql } from 'drizzle-orm';
import { type DB } from '@/lib/db';
import { adsDaily, ga4Daily } from '@/lib/schema';

export type AdsDailyRow = typeof adsDaily.$inferInsert;
export type GA4DailyRow = typeof ga4Daily.$inferInsert;

export async function upsertAdsDaily(db: DB, rows: AdsDailyRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  await db
    .insert(adsDaily)
    .values(rows)
    .onConflictDoUpdate({
      target: [adsDaily.date, adsDaily.platform, adsDaily.campaignId],
      set: {
        campaignName: sql`excluded.campaign_name`,
        campaignStatus: sql`excluded.campaign_status`,
        campaignObjective: sql`excluded.campaign_objective`,
        adGroupId: sql`excluded.ad_group_id`,
        adGroupName: sql`excluded.ad_group_name`,
        accountId: sql`excluded.account_id`,
        spend: sql`excluded.spend`,
        impressions: sql`excluded.impressions`,
        clicks: sql`excluded.clicks`,
        ctr: sql`excluded.ctr`,
        cpc: sql`excluded.cpc`,
        cpm: sql`excluded.cpm`,
        conversions: sql`excluded.conversions`,
        conversionValue: sql`excluded.conversion_value`,
        updatedAt: sql`now()`,
      },
    });
  return rows.length;
}

export async function upsertGA4Daily(db: DB, rows: GA4DailyRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  await db
    .insert(ga4Daily)
    .values(rows)
    .onConflictDoUpdate({
      target: [ga4Daily.date, ga4Daily.channelGroup, ga4Daily.source, ga4Daily.medium],
      set: {
        sessions: sql`excluded.sessions`,
        users: sql`excluded.users`,
        newUsers: sql`excluded.new_users`,
        engagedSessions: sql`excluded.engaged_sessions`,
        bounceRate: sql`excluded.bounce_rate`,
        transactions: sql`excluded.transactions`,
        revenue: sql`excluded.revenue`,
        itemsViewed: sql`excluded.items_viewed`,
        addToCart: sql`excluded.add_to_cart`,
        beginCheckout: sql`excluded.begin_checkout`,
        updatedAt: sql`now()`,
      },
    });
  return rows.length;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export { toNum, toNumOrNull };
