/**
 * Meta (Facebook) Ads sync via the Graph API directly.
 *
 * Why not MCP? The MCP wrapper exposes only `date_preset` presets, with no
 * way to request true daily breakdown. This module calls `/act_.../insights`
 * with `time_increment=1` so every date returns its own row — matching the
 * user's Ads Manager numbers exactly.
 *
 * Token: META_GRAPH_API_TOKEN env. Account: META_ACCOUNT_ID env.
 */
import { sql } from 'drizzle-orm';
import { db as defaultDb, type DB } from '@/lib/db';
import { upsertAdsDaily, toNum, toNumOrNull, type AdsDailyRow } from './upsert';
import { type DateRange } from '@/lib/periods';

const GRAPH_URL = 'https://graph.facebook.com/v22.0';

export const METRICS = [
  'campaign_id',
  'campaign_name',
  'spend',
  'impressions',
  'clicks',
  'ctr',
  'cpc',
  'cpm',
  'actions',
  'action_values',
  'date_start',
  'date_stop',
] as const;

const PURCHASE_ACTIONS = new Set([
  'purchase',
  'offsite_conversion.fb_pixel_purchase',
  'omni_purchase',
]);

export type MetaInsight = {
  campaign_id: string;
  campaign_name?: string;
  date_start?: string;
  date_stop?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
};

export function extractPurchase(row: MetaInsight): { conversions: number; conversionValue: number } {
  const convRow = row.actions?.find((a) => PURCHASE_ACTIONS.has(a.action_type));
  const valRow = row.action_values?.find((a) => PURCHASE_ACTIONS.has(a.action_type));
  return {
    conversions: toNum(convRow?.value),
    conversionValue: toNum(valRow?.value),
  };
}

type GraphResponse = {
  data: MetaInsight[];
  paging?: { next?: string };
};

export async function syncMetaGraph(
  range: DateRange,
  opts: { db?: DB; token?: string; accountId?: string } = {},
): Promise<{ rowsWritten: number }> {
  const database = opts.db ?? defaultDb;
  const token = opts.token ?? process.env.META_GRAPH_API_TOKEN;
  const accountId = opts.accountId ?? process.env.META_ACCOUNT_ID ?? 'act_295812916';
  if (!token) throw new Error('META_GRAPH_API_TOKEN missing');

  const params = new URLSearchParams({
    access_token: token,
    level: 'campaign',
    time_range: JSON.stringify({ since: range.start, until: range.end }),
    time_increment: '1',
    fields: METRICS.join(','),
    limit: '500',
  });

  const rows: MetaInsight[] = [];
  let url: string | null = `${GRAPH_URL}/${accountId}/insights?${params}`;
  while (url) {
    const res: Response = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Meta Graph ${res.status}: ${body}`);
    }
    const data = (await res.json()) as GraphResponse;
    rows.push(...(data.data ?? []));
    url = data.paging?.next ?? null;
  }

  // Replace Meta's window fully — avoids stale rows from previous runs
  // (especially aggregate-spread leftovers from the legacy syncMeta).
  await database.execute(
    sql`DELETE FROM ads_daily WHERE platform='meta' AND date BETWEEN ${range.start} AND ${range.end}`,
  );

  const adsRows: AdsDailyRow[] = [];
  for (const r of rows) {
    const date = r.date_start;
    if (!date || !r.campaign_id) continue;
    const p = extractPurchase(r);
    const impressions = toNum(r.impressions);
    const clicks = toNum(r.clicks);
    const spend = toNum(r.spend);
    adsRows.push({
      date,
      platform: 'meta',
      accountId,
      campaignId: String(r.campaign_id),
      campaignName: r.campaign_name ?? '',
      campaignStatus: null,
      campaignObjective: null,
      adGroupId: null,
      adGroupName: null,
      spend: String(spend),
      impressions: Math.round(impressions),
      clicks: Math.round(clicks),
      ctr: toNumOrNull(r.ctr)?.toString() ?? null,
      cpc: toNumOrNull(r.cpc)?.toString() ?? null,
      cpm: toNumOrNull(r.cpm)?.toString() ?? null,
      conversions: String(p.conversions),
      conversionValue: String(p.conversionValue),
    });
  }

  const rowsWritten = await upsertAdsDaily(database, adsRows);
  return { rowsWritten };
}
