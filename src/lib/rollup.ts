/**
 * Rollup builder: computes dashboard_cache entries for every (period, platform, compare) tuple.
 *
 * Runs after each sync. Each cache entry holds a denormalized JSONB payload that the
 * `/api/data/*` routes return as-is — keeps the hot path O(1).
 */
import { db as defaultDb, type DB } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { dashboardCache } from '@/lib/schema';
import {
  PERIOD_KEYS,
  resolvePeriod,
  resolveCompare,
  type PeriodKey,
  type CompareKey,
  type DateRange,
} from '@/lib/periods';

export type KPIs = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  revenue: number;
  sessions: number;
  transactions: number;
  users: number;
  newUsers: number;
  engagedSessions: number;
  bounceRate: number | null;
  itemsViewed: number;
  addToCart: number;
  beginCheckout: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cos: number | null;
  roas: number | null;
  aov: number | null;
};

export type RollupPayload = {
  range: DateRange;
  compareRange: DateRange | null;
  platform: Platform;
  kpis: KPIs;
  compareKpis: KPIs | null;
  deltas: Partial<Record<keyof KPIs, number>>;
  timeSeries: Array<{
    date: string;
    spend: number;
    revenue: number;
    sessions: number;
    transactions: number;
  }>;
  campaigns: Array<{
    platform: string;
    id: string;
    name: string;
    status: string | null;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    conversionValue: number;
    ctr: number | null;
    cpc: number | null;
    cpm: number | null;
    cos: number | null;
    roas: number | null;
  }>;
  channelBreakdown: Array<{
    channelGroup: string;
    sessions: number;
    users: number;
    transactions: number;
    revenue: number;
  }>;
  warnings: string[];
};

export type Platform =
  | 'all' | 'meta' | 'google_ads' | 'criteo' | 'pinterest' | 'ga4';

const AD_PLATFORMS: Array<Exclude<Platform, 'all' | 'ga4'>> = [
  'meta', 'google_ads', 'criteo', 'pinterest',
];

const EMPTY_KPIS: KPIs = {
  spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0,
  revenue: 0, sessions: 0, transactions: 0, users: 0, newUsers: 0,
  engagedSessions: 0, bounceRate: null, itemsViewed: 0, addToCart: 0, beginCheckout: 0,
  ctr: null, cpc: null, cpm: null, cos: null, roas: null, aov: null,
};

function safeDiv(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return a / b;
}

function deriveDerived(k: KPIs): KPIs {
  return {
    ...k,
    ctr: safeDiv(k.clicks, k.impressions),
    cpc: safeDiv(k.spend, k.clicks),
    cpm: safeDiv(k.spend * 1000, k.impressions),
    cos: safeDiv(k.spend, k.revenue),
    roas: safeDiv(k.revenue, k.spend),
    aov: safeDiv(k.revenue, k.transactions),
  };
}

async function loadAdsKPIs(db: DB, range: DateRange, platform: Platform): Promise<{
  kpis: Partial<KPIs>;
  timeSeries: Array<{ date: string; spend: number; revenue: number }>;
  campaigns: RollupPayload['campaigns'];
}> {
  const filter = platform === 'all' || platform === 'ga4'
    ? sql`platform IN ('meta', 'google_ads', 'criteo', 'pinterest')`
    : sql`platform = ${platform}`;

  const totals: any = await db.execute(sql`
    SELECT
      COALESCE(SUM(spend), 0)::float AS spend,
      COALESCE(SUM(impressions), 0)::int AS impressions,
      COALESCE(SUM(clicks), 0)::int AS clicks,
      COALESCE(SUM(conversions), 0)::float AS conversions,
      COALESCE(SUM(conversion_value), 0)::float AS conversion_value
    FROM ads_daily
    WHERE ${filter} AND date BETWEEN ${range.start} AND ${range.end}
  `);
  const t = totals.rows?.[0] ?? totals[0] ?? {};

  const tsRes: any = await db.execute(sql`
    SELECT
      date::text AS date,
      COALESCE(SUM(spend), 0)::float AS spend,
      COALESCE(SUM(conversion_value), 0)::float AS revenue
    FROM ads_daily
    WHERE ${filter} AND date BETWEEN ${range.start} AND ${range.end}
    GROUP BY date
    ORDER BY date
  `);
  const timeSeries = (tsRes.rows ?? tsRes).map((r: any) => ({
    date: r.date,
    spend: Number(r.spend),
    revenue: Number(r.revenue),
  }));

  const campRes: any = await db.execute(sql`
    SELECT
      platform, campaign_id AS id, campaign_name AS name,
      MAX(campaign_status) AS status,
      COALESCE(SUM(spend), 0)::float AS spend,
      COALESCE(SUM(impressions), 0)::int AS impressions,
      COALESCE(SUM(clicks), 0)::int AS clicks,
      COALESCE(SUM(conversions), 0)::float AS conversions,
      COALESCE(SUM(conversion_value), 0)::float AS conversion_value
    FROM ads_daily
    WHERE ${filter} AND date BETWEEN ${range.start} AND ${range.end}
    GROUP BY platform, campaign_id, campaign_name
    ORDER BY spend DESC
    LIMIT 500
  `);
  const campaigns: RollupPayload['campaigns'] = (campRes.rows ?? campRes).map((r: any) => {
    const spend = Number(r.spend);
    const impressions = Number(r.impressions);
    const clicks = Number(r.clicks);
    const conversions = Number(r.conversions);
    const conversionValue = Number(r.conversion_value);
    return {
      platform: r.platform,
      id: String(r.id),
      name: r.name ?? '',
      status: r.status ?? null,
      spend,
      impressions,
      clicks,
      conversions,
      conversionValue,
      ctr: safeDiv(clicks, impressions),
      cpc: safeDiv(spend, clicks),
      cpm: safeDiv(spend * 1000, impressions),
      cos: safeDiv(spend, conversionValue),
      roas: safeDiv(conversionValue, spend),
    };
  });

  return {
    kpis: {
      spend: Number(t.spend ?? 0),
      impressions: Number(t.impressions ?? 0),
      clicks: Number(t.clicks ?? 0),
      conversions: Number(t.conversions ?? 0),
      conversionValue: Number(t.conversion_value ?? 0),
    },
    timeSeries,
    campaigns,
  };
}

async function loadGA4KPIs(db: DB, range: DateRange): Promise<{
  kpis: Partial<KPIs>;
  timeSeries: Array<{ date: string; sessions: number; revenue: number; transactions: number }>;
  channels: RollupPayload['channelBreakdown'];
}> {
  const totals: any = await db.execute(sql`
    SELECT
      COALESCE(SUM(sessions), 0)::int AS sessions,
      COALESCE(SUM(users), 0)::int AS users,
      COALESCE(SUM(new_users), 0)::int AS new_users,
      COALESCE(SUM(engaged_sessions), 0)::int AS engaged,
      COALESCE(AVG(bounce_rate), 0)::float AS bounce_rate,
      COALESCE(SUM(transactions), 0)::int AS transactions,
      COALESCE(SUM(revenue), 0)::float AS revenue,
      COALESCE(SUM(items_viewed), 0)::int AS items_viewed,
      COALESCE(SUM(add_to_cart), 0)::int AS add_to_cart,
      COALESCE(SUM(begin_checkout), 0)::int AS begin_checkout
    FROM ga4_daily
    WHERE date BETWEEN ${range.start} AND ${range.end}
  `);
  const t = totals.rows?.[0] ?? totals[0] ?? {};

  const tsRes: any = await db.execute(sql`
    SELECT
      date::text AS date,
      COALESCE(SUM(sessions), 0)::int AS sessions,
      COALESCE(SUM(revenue), 0)::float AS revenue,
      COALESCE(SUM(transactions), 0)::int AS transactions
    FROM ga4_daily
    WHERE date BETWEEN ${range.start} AND ${range.end}
    GROUP BY date
    ORDER BY date
  `);
  const timeSeries = (tsRes.rows ?? tsRes).map((r: any) => ({
    date: r.date,
    sessions: Number(r.sessions),
    revenue: Number(r.revenue),
    transactions: Number(r.transactions),
  }));

  const chanRes: any = await db.execute(sql`
    SELECT
      channel_group AS "channelGroup",
      COALESCE(SUM(sessions), 0)::int AS sessions,
      COALESCE(SUM(users), 0)::int AS users,
      COALESCE(SUM(transactions), 0)::int AS transactions,
      COALESCE(SUM(revenue), 0)::float AS revenue
    FROM ga4_daily
    WHERE date BETWEEN ${range.start} AND ${range.end}
    GROUP BY channel_group
    ORDER BY sessions DESC
  `);
  const channels: RollupPayload['channelBreakdown'] = (chanRes.rows ?? chanRes).map((r: any) => ({
    channelGroup: r.channelGroup ?? 'Unassigned',
    sessions: Number(r.sessions),
    users: Number(r.users),
    transactions: Number(r.transactions),
    revenue: Number(r.revenue),
  }));

  return {
    kpis: {
      sessions: Number(t.sessions ?? 0),
      users: Number(t.users ?? 0),
      newUsers: Number(t.new_users ?? 0),
      engagedSessions: Number(t.engaged ?? 0),
      bounceRate: Number(t.bounce_rate ?? 0) || null,
      transactions: Number(t.transactions ?? 0),
      revenue: Number(t.revenue ?? 0),
      itemsViewed: Number(t.items_viewed ?? 0),
      addToCart: Number(t.add_to_cart ?? 0),
      beginCheckout: Number(t.begin_checkout ?? 0),
    },
    timeSeries,
    channels,
  };
}

async function buildOne(
  db: DB,
  platform: Platform,
  range: DateRange,
  compareRange: DateRange | null
): Promise<RollupPayload> {
  const warnings: string[] = [];

  // Pinterest has the Windsor 30-day cap.
  const rangeDays = Math.round(
    (new Date(range.end).getTime() - new Date(range.start).getTime()) / 86400000
  ) + 1;
  if (platform === 'pinterest' && rangeDays > 30) warnings.push('pinterest_30d_cap');

  // Ads metrics
  const needsAds = platform !== 'ga4';
  const ads = needsAds ? await loadAdsKPIs(db, range, platform) : null;
  const adsCompare = needsAds && compareRange ? await loadAdsKPIs(db, compareRange, platform) : null;

  // GA4 metrics (always included so revenue reflects real site transactions when available)
  const ga4 = await loadGA4KPIs(db, range);
  const ga4Compare = compareRange ? await loadGA4KPIs(db, compareRange) : null;

  // Merge current
  const mergedBase: KPIs = {
    ...EMPTY_KPIS,
    ...(ads?.kpis ?? {}),
    ...(ga4.kpis ?? {}),
  };
  // For platform != ga4, prefer GA4 revenue/transactions/sessions as site-level truth.
  // For platform === ga4, same.
  const kpis = deriveDerived(mergedBase);

  let compareKpis: KPIs | null = null;
  if (compareRange && (adsCompare || ga4Compare)) {
    const mergedCmp: KPIs = {
      ...EMPTY_KPIS,
      ...(adsCompare?.kpis ?? {}),
      ...(ga4Compare?.kpis ?? {}),
    };
    compareKpis = deriveDerived(mergedCmp);
  }

  const deltas: Partial<Record<keyof KPIs, number>> = {};
  if (compareKpis) {
    for (const key of Object.keys(kpis) as Array<keyof KPIs>) {
      const cur = kpis[key];
      const prev = compareKpis[key];
      if (typeof cur === 'number' && typeof prev === 'number' && prev !== 0) {
        deltas[key] = (cur - prev) / prev;
      } else if (typeof cur === 'number' && typeof prev === 'number' && prev === 0 && cur > 0) {
        deltas[key] = 1; // 100% growth from zero
      }
    }
  }

  // Merge ads time series with GA4 time series on date.
  const tsMap = new Map<string, { date: string; spend: number; revenue: number; sessions: number; transactions: number }>();
  for (const r of ads?.timeSeries ?? []) {
    tsMap.set(r.date, { date: r.date, spend: r.spend, revenue: r.revenue, sessions: 0, transactions: 0 });
  }
  for (const r of ga4.timeSeries) {
    const existing = tsMap.get(r.date) ?? { date: r.date, spend: 0, revenue: 0, sessions: 0, transactions: 0 };
    // Prefer GA4 revenue for site-level when platform is 'all' or 'ga4'.
    if (platform === 'all' || platform === 'ga4') {
      existing.revenue = Math.max(existing.revenue, r.revenue);
    }
    existing.sessions = r.sessions;
    existing.transactions = r.transactions;
    tsMap.set(r.date, existing);
  }
  const timeSeries = Array.from(tsMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    range,
    compareRange,
    platform,
    kpis,
    compareKpis,
    deltas,
    timeSeries,
    campaigns: ads?.campaigns ?? [],
    channelBreakdown: ga4.channels,
    warnings,
  };
}

const COMPARE_KEYS: CompareKey[] = ['previous_period', 'same_period_last_year', 'none'];
const ALL_PLATFORMS: Platform[] = ['all', 'meta', 'google_ads', 'criteo', 'pinterest', 'ga4'];

export async function buildRollups(dbIn: DB = defaultDb): Promise<{ cached: number }> {
  let cached = 0;

  for (const periodKey of PERIOD_KEYS) {
    const range = resolvePeriod(periodKey as PeriodKey);
    for (const compareKey of COMPARE_KEYS) {
      const compareRange = resolveCompare(range, compareKey);
      for (const platform of ALL_PLATFORMS) {
        const payload = await buildOne(dbIn, platform, range, compareRange);
        await dbIn
          .insert(dashboardCache)
          .values({
            periodKey: periodKey as string,
            platform,
            compareKey,
            payload,
          })
          .onConflictDoUpdate({
            target: [dashboardCache.periodKey, dashboardCache.platform, dashboardCache.compareKey],
            set: { payload, computedAt: sql`now()` },
          });
        cached++;
      }
    }
  }

  return { cached };
}
