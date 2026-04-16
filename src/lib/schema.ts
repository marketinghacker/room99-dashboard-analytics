import {
  pgTable, text, date, integer, numeric, timestamp, jsonb, uuid, index, primaryKey, doublePrecision,
} from 'drizzle-orm/pg-core';

export const adsDaily = pgTable(
  'ads_daily',
  {
    date: date('date').notNull(),
    platform: text('platform').notNull(), // 'meta' | 'google_ads' | 'criteo'
    accountId: text('account_id').notNull(),
    campaignId: text('campaign_id').notNull(),
    campaignName: text('campaign_name').notNull(),
    campaignStatus: text('campaign_status'),
    campaignObjective: text('campaign_objective'),
    adGroupId: text('ad_group_id'),
    adGroupName: text('ad_group_name'),
    spend: numeric('spend', { precision: 14, scale: 4 }).notNull().default('0'),
    impressions: integer('impressions').notNull().default(0),
    clicks: integer('clicks').notNull().default(0),
    ctr: numeric('ctr', { precision: 10, scale: 6 }),
    cpc: numeric('cpc', { precision: 10, scale: 4 }),
    cpm: numeric('cpm', { precision: 10, scale: 4 }),
    conversions: numeric('conversions', { precision: 14, scale: 4 }).default('0'),
    conversionValue: numeric('conversion_value', { precision: 14, scale: 4 }).default('0'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.date, t.platform, t.campaignId] }),
    platformDateIdx: index('ads_daily_platform_date_idx').on(t.platform, t.date),
    dateIdx: index('ads_daily_date_idx').on(t.date),
  })
);

export const ga4Daily = pgTable(
  'ga4_daily',
  {
    date: date('date').notNull(),
    channelGroup: text('channel_group').notNull(),
    source: text('source').notNull(),
    medium: text('medium').notNull(),
    sessions: integer('sessions').notNull().default(0),
    users: integer('users').notNull().default(0),
    newUsers: integer('new_users').notNull().default(0),
    engagedSessions: integer('engaged_sessions').notNull().default(0),
    bounceRate: numeric('bounce_rate', { precision: 6, scale: 4 }),
    transactions: integer('transactions').notNull().default(0),
    revenue: numeric('revenue', { precision: 14, scale: 4 }).notNull().default('0'),
    itemsViewed: integer('items_viewed').notNull().default(0),
    addToCart: integer('add_to_cart').notNull().default(0),
    beginCheckout: integer('begin_checkout').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.date, t.channelGroup, t.source, t.medium] }),
    dateIdx: index('ga4_daily_date_idx').on(t.date),
  })
);

// Windsor writes here. We do NOT alter — define schema to match actual DB types.
// Numeric-looking TEXT columns (conversions, conversion_value, ctr, roas) are Windsor quirks.
export const adPerformanceDaily = pgTable('ad_performance_daily', {
  accountName: text('account_name'),
  adGroup: text('ad_group'),
  campaign: text('campaign'),
  campaignObjective: text('campaign_objective'),
  campaignStatus: text('campaign_status'),
  clicks: doublePrecision('clicks'),
  conversions: text('conversions'),
  conversionValue: text('conversion_value'),
  cpc: doublePrecision('cpc'),
  cpm: doublePrecision('cpm'),
  ctr: text('ctr'),
  datasource: text('datasource'),
  date: date('date'),
  impressions: doublePrecision('impressions'),
  roas: text('roas'),
  source: text('source'),
  spend: doublePrecision('spend'),
});

export const dashboardCache = pgTable(
  'dashboard_cache',
  {
    periodKey: text('period_key').notNull(),
    platform: text('platform').notNull(),
    compareKey: text('compare_key').notNull().default('none'),
    payload: jsonb('payload').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.periodKey, t.platform, t.compareKey] }),
  })
);

/**
 * SellRocket (BaseLinker) daily sales rollup.
 * `source` is the BaseLinker order source name (allegro, SHR, MORELE, …)
 * or 'all' for the day's aggregate across every source.
 */
export const sellrocketDaily = pgTable(
  'sellrocket_daily',
  {
    date: date('date').notNull(),
    source: text('source').notNull().default('all'),
    orderCount: integer('order_count').notNull().default(0),
    revenue: numeric('revenue', { precision: 14, scale: 4 }).notNull().default('0'),
    avgOrderValue: numeric('avg_order_value', { precision: 14, scale: 4 }).notNull().default('0'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.date, t.source] }),
    dateIdx: index('sellrocket_daily_date_idx').on(t.date),
  })
);

export const syncRuns = pgTable('sync_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: text('status').notNull(), // 'running' | 'success' | 'partial' | 'failed'
  source: text('source').notNull(),
  rowsWritten: integer('rows_written').default(0),
  error: text('error'),
});
