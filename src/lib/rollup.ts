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

/**
 * Room99 canonical revenue source: Shoper (BaseLinker source code 'shr').
 * This is what the agency is paid to grow. Anything Allegro/marketplace is
 * outside the agency's scope but we track it as a benchmark.
 */
export const REVENUE_SOURCE = 'shr';

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
  /** Platform-attributed ROAS = conversionValue / spend. Meta/Google's own numbers. */
  platformRoas: number | null;
  /** Platform-attributed COS = spend / conversionValue. */
  platformCos: number | null;
};

export type SalesBySource = {
  shr: { revenue: number; orders: number; aov: number | null };
  allegro: { revenue: number; orders: number; aov: number | null };
  all: { revenue: number; orders: number; aov: number | null };
  /** Derived = all - shr - allegro (marketplaces, B2B, manual etc.) */
  other: { revenue: number; orders: number; aov: number | null };
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
    revenue: number;    // Shoper revenue (primary)
    revenueAll: number; // All channels combined (reference)
    sessions: number;
    transactions: number;
    ordersShr: number;
    ordersAllegro: number;
    // Per-platform spend so UI can stack / compute COS-per-platform day-by-day
    spendMeta: number;
    spendGoogle: number;
    spendCriteo: number;
    spendPinterest: number;
    /** COS = total spend / Shoper revenue — critical KPI for agency scope. */
    cos: number | null;
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
  /** Sales by BaseLinker order source — only meaningful on platform='all' / 'sellrocket'. */
  salesBySource: SalesBySource;
  warnings: string[];
};

export type Platform =
  | 'all' | 'meta' | 'google_ads' | 'criteo' | 'pinterest' | 'ga4' | 'sellrocket';

const AD_PLATFORMS: Array<Exclude<Platform, 'all' | 'ga4'>> = [
  'meta', 'google_ads', 'criteo', 'pinterest',
];

const EMPTY_KPIS: KPIs = {
  spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0,
  revenue: 0, sessions: 0, transactions: 0, users: 0, newUsers: 0,
  engagedSessions: 0, bounceRate: null, itemsViewed: 0, addToCart: 0, beginCheckout: 0,
  ctr: null, cpc: null, cpm: null, cos: null, roas: null, aov: null,
  platformRoas: null, platformCos: null,
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
    // Agency-scope: spend / Shoper revenue → "ile budżet vs całkowity przychód"
    cos: safeDiv(k.spend, k.revenue),
    roas: safeDiv(k.revenue, k.spend),
    aov: safeDiv(k.revenue, k.transactions),
    // Platform-attributed (Meta/Google own attribution): conversionValue / spend
    platformRoas: safeDiv(k.conversionValue, k.spend),
    platformCos: safeDiv(k.spend, k.conversionValue),
  };
}

async function loadAdsKPIs(db: DB, range: DateRange, platform: Platform): Promise<{
  kpis: Partial<KPIs>;
  timeSeries: Array<{ date: string; spend: number; revenue: number; spendByPlatform: Record<string, number> }>;
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

  // Per-day, per-platform spend so Executive Summary can render a stacked COS
  // breakdown (which platform contributes most to today's COS).
  const tsRes: any = await db.execute(sql`
    SELECT
      date::text AS date,
      platform,
      COALESCE(SUM(spend), 0)::float AS spend,
      COALESCE(SUM(conversion_value), 0)::float AS revenue
    FROM ads_daily
    WHERE ${filter} AND date BETWEEN ${range.start} AND ${range.end}
    GROUP BY date, platform
    ORDER BY date
  `);
  const byDate = new Map<string, { date: string; spend: number; revenue: number; spendByPlatform: Record<string, number> }>();
  for (const r of (tsRes.rows ?? tsRes)) {
    const d = r.date;
    const spend = Number(r.spend);
    const rev = Number(r.revenue);
    let e = byDate.get(d);
    if (!e) {
      e = { date: d, spend: 0, revenue: 0, spendByPlatform: {} };
      byDate.set(d, e);
    }
    e.spend += spend;
    e.revenue += rev;
    e.spendByPlatform[r.platform] = (e.spendByPlatform[r.platform] ?? 0) + spend;
  }
  const timeSeries = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

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

async function loadSellRocketKPIs(db: DB, range: DateRange): Promise<{
  salesBySource: SalesBySource;
  shrTimeSeries: Array<{ date: string; revenue: number; orders: number }>;
  allegroTimeSeries: Array<{ date: string; revenue: number; orders: number }>;
  allTimeSeries: Array<{ date: string; revenue: number; orders: number }>;
}> {
  const totals: any = await db.execute(sql`
    SELECT
      source,
      COALESCE(SUM(order_count), 0)::int AS orders,
      COALESCE(SUM(revenue), 0)::float AS revenue
    FROM sellrocket_daily
    WHERE date BETWEEN ${range.start} AND ${range.end}
    GROUP BY source
  `);
  const rows = (totals.rows ?? totals) as Array<{ source: string; orders: number; revenue: number }>;

  const get = (s: string) => {
    const r = rows.find((x) => x.source === s);
    const revenue = Number(r?.revenue ?? 0);
    const orders = Number(r?.orders ?? 0);
    return { revenue, orders, aov: orders > 0 ? revenue / orders : null };
  };

  const shr = get('shr');
  const allegro = get('allegro');
  const all = get('all');
  const otherRevenue = Math.max(0, all.revenue - shr.revenue - allegro.revenue);
  const otherOrders = Math.max(0, all.orders - shr.orders - allegro.orders);
  const other = {
    revenue: otherRevenue,
    orders: otherOrders,
    aov: otherOrders > 0 ? otherRevenue / otherOrders : null,
  };

  const tsRes: any = await db.execute(sql`
    SELECT
      date::text AS date,
      source,
      revenue::float AS revenue,
      order_count AS orders
    FROM sellrocket_daily
    WHERE date BETWEEN ${range.start} AND ${range.end}
    ORDER BY date ASC
  `);
  const tsRows = (tsRes.rows ?? tsRes) as Array<{ date: string; source: string; revenue: number; orders: number }>;

  const filterBy = (src: string) => tsRows
    .filter((r) => r.source === src)
    .map((r) => ({ date: r.date, revenue: Number(r.revenue), orders: Number(r.orders) }));

  return {
    salesBySource: { shr, allegro, all, other },
    shrTimeSeries: filterBy('shr'),
    allegroTimeSeries: filterBy('allegro'),
    allTimeSeries: filterBy('all'),
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

export async function buildOneLive(
  db: DB,
  platform: Platform,
  range: DateRange,
  compareRange: DateRange | null,
): Promise<RollupPayload> {
  const warnings: string[] = [];

  const rangeDays = Math.round(
    (new Date(range.end).getTime() - new Date(range.start).getTime()) / 86400000
  ) + 1;
  if (platform === 'pinterest' && rangeDays > 30) warnings.push('pinterest_30d_cap');

  // Ads metrics (all platforms except ga4 have their own spend)
  const needsAds = platform !== 'ga4';
  const ads = needsAds ? await loadAdsKPIs(db, range, platform) : null;
  const adsCompare = needsAds && compareRange ? await loadAdsKPIs(db, compareRange, platform) : null;

  // GA4 — site traffic only: sessions, users, bounce, funnel events.
  // NOT revenue/transactions (those come from SellRocket).
  const ga4 = await loadGA4KPIs(db, range);
  const ga4Compare = compareRange ? await loadGA4KPIs(db, compareRange) : null;

  // SellRocket — the source of truth for sales, filtered to Shoper (SHR).
  const sr = await loadSellRocketKPIs(db, range);
  const srCompare = compareRange ? await loadSellRocketKPIs(db, compareRange) : null;

  // Merge: ads gives spend + ad-platform conversionValue/conversions.
  //        GA4 gives sessions/users/newUsers/engagedSessions/bounce + funnel events.
  //        SellRocket gives the authoritative revenue/transactions/AOV (SHR).
  const build = (
    a: typeof ads | null,
    g: typeof ga4 | null,
    s: typeof sr | null,
  ): KPIs => {
    const merged: KPIs = {
      ...EMPTY_KPIS,
      ...(a?.kpis ?? {}),
      ...(g?.kpis ?? {}),
      // Override GA4 revenue/transactions with Shoper SellRocket data.
      revenue: s?.salesBySource.shr.revenue ?? 0,
      transactions: s?.salesBySource.shr.orders ?? 0,
    };
    // Re-derive AOV/COS/ROAS based on the Shoper numbers.
    return deriveDerived(merged);
  };

  const kpis = build(ads, ga4, sr);
  const compareKpis = compareRange
    ? build(adsCompare, ga4Compare, srCompare)
    : null;

  const deltas: Partial<Record<keyof KPIs, number>> = {};
  if (compareKpis) {
    for (const key of Object.keys(kpis) as Array<keyof KPIs>) {
      const cur = kpis[key];
      const prev = compareKpis[key];
      if (typeof cur === 'number' && typeof prev === 'number' && prev !== 0) {
        deltas[key] = (cur - prev) / prev;
      } else if (typeof cur === 'number' && typeof prev === 'number' && prev === 0 && cur > 0) {
        deltas[key] = 1;
      }
    }
  }

  // Time series: spend (ads per-platform) + SHR revenue (sellrocket) + GA4 sessions.
  const tsMap = new Map<string, RollupPayload['timeSeries'][number]>();
  const ensure = (date: string) => {
    let existing = tsMap.get(date);
    if (!existing) {
      existing = {
        date, spend: 0, revenue: 0, revenueAll: 0,
        sessions: 0, transactions: 0, ordersShr: 0, ordersAllegro: 0,
        spendMeta: 0, spendGoogle: 0, spendCriteo: 0, spendPinterest: 0,
        cos: null,
      };
      tsMap.set(date, existing);
    }
    return existing;
  };
  for (const r of ads?.timeSeries ?? []) {
    const e = ensure(r.date);
    e.spend = r.spend;
    e.spendMeta = r.spendByPlatform.meta ?? 0;
    e.spendGoogle = r.spendByPlatform.google_ads ?? 0;
    e.spendCriteo = r.spendByPlatform.criteo ?? 0;
    e.spendPinterest = r.spendByPlatform.pinterest ?? 0;
  }
  for (const r of ga4.timeSeries) {
    const e = ensure(r.date);
    e.sessions = r.sessions;
  }
  for (const r of sr.shrTimeSeries) {
    const e = ensure(r.date);
    e.revenue = r.revenue;
    e.transactions = r.orders;
    e.ordersShr = r.orders;
  }
  for (const r of sr.allegroTimeSeries) {
    ensure(r.date).ordersAllegro = r.orders;
  }
  for (const r of sr.allTimeSeries) {
    ensure(r.date).revenueAll = r.revenue;
  }
  // Compute daily COS = spend / Shoper revenue (agency scope).
  for (const e of tsMap.values()) {
    e.cos = e.revenue > 0 ? e.spend / e.revenue : null;
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
    salesBySource: sr.salesBySource,
    warnings,
  };
}

const COMPARE_KEYS: CompareKey[] = ['previous_period', 'same_period_last_year', 'none'];
const ALL_PLATFORMS: Platform[] = ['all', 'meta', 'google_ads', 'criteo', 'pinterest', 'ga4', 'sellrocket'];

/**
 * Given a set of ISO dates that changed, returns the preset period keys whose
 * resolved date range includes at least one of those dates. Used for incremental
 * rollup rebuilds — only invalidate caches that actually cover changed data.
 */
export function affectedPeriods(dates: string[], now: Date = new Date()): PeriodKey[] {
  const affected: PeriodKey[] = [];
  for (const pk of PERIOD_KEYS) {
    const range = resolvePeriod(pk as PeriodKey, now);
    for (const d of dates) {
      if (d >= range.start && d <= range.end) {
        affected.push(pk as PeriodKey);
        break;
      }
    }
  }
  return affected;
}

export async function buildRollups(
  dbIn: DB = defaultDb,
  opts: { onlyDates?: string[] } = {},
): Promise<{ cached: number }> {
  let cached = 0;

  const periodKeys = opts.onlyDates
    ? (affectedPeriods(opts.onlyDates) as readonly string[])
    : (PERIOD_KEYS as readonly string[]);

  for (const periodKey of periodKeys) {
    const range = resolvePeriod(periodKey as PeriodKey);
    for (const compareKey of COMPARE_KEYS) {
      const compareRange = resolveCompare(range, compareKey);
      for (const platform of ALL_PLATFORMS) {
        const payload = await buildOneLive(dbIn, platform, range, compareRange);
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
