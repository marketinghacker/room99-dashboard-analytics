/**
 * SellRocket/BaseLinker sync via direct API (X-BLToken) — replaces MCP for
 * accurate Allegro sub-account totals.
 *
 * Sources we care about for Room99 (from get_order_sources probe):
 *   id=9  name=Room99.pl       category=SHR       (own shop, agency scope)
 *   id=8  name=Room99_Official category=ALL       (Allegro primary)
 *   id=7  name=e_homeconcept   category=ALL       (Allegro secondary)
 *   + CENEO, EMAG, EMP, ERLI, MORELE, SHOPEE, Amazon Vendor DE/FR, BEEL…
 *
 * Env: BASELINKER_API_TOKEN
 */
import { sql } from 'drizzle-orm';
import { db as defaultDb, type DB } from '@/lib/db';
import { sellrocketDaily } from '@/lib/schema';
import { BaseLinkerAPI } from './baselinker-api';
import { type DateRange } from '@/lib/periods';

/**
 * Logical buckets mapped to BaseLinker order_source_id(s).
 * Extend as new Allegro sub-accounts appear in BaseLinker.
 */
export const SOURCE_BUCKETS: Record<'shr' | 'allegro', number[]> = {
  shr: [9],        // Room99.pl Shoper
  allegro: [8, 7], // Room99_Official + e_homeconcept (both ALLEGRO category)
};

export type Bucket = keyof typeof SOURCE_BUCKETS;

/**
 * Sync Shoper + Allegro revenue for a date range using the direct BaseLinker API.
 * Writes per-bucket-per-day rows into sellrocket_daily + a derived 'all' row
 * that sums across buckets.
 */
export async function syncSellRocketDirect(
  range: DateRange,
  opts: { db?: DB; token?: string; buckets?: Bucket[] } = {}
): Promise<{ rowsWritten: number }> {
  const database = opts.db ?? defaultDb;
  const token = opts.token ?? process.env.BASELINKER_API_TOKEN;
  if (!token) throw new Error('BASELINKER_API_TOKEN missing — add it to Railway Variables');

  const api = new BaseLinkerAPI(token);
  const buckets: Bucket[] = opts.buckets ?? ['shr', 'allegro'];

  let rowsWritten = 0;
  const t0 = Date.now();

  for (const bucket of buckets) {
    const sourceIds = SOURCE_BUCKETS[bucket];
    console.log(`[baselinker] bucket=${bucket} source_ids=[${sourceIds.join(',')}] range=${range.start}..${range.end}`);

    // Sum across source ids within the bucket.
    const byDate = new Map<string, { orders: number; revenue: number }>();
    for (const sourceId of sourceIds) {
      const rows = await api.dailyRevenueBySource({
        start: range.start,
        end: range.end,
        sourceIds: [sourceId],
      });
      for (const r of rows) {
        let e = byDate.get(r.date);
        if (!e) { e = { orders: 0, revenue: 0 }; byDate.set(r.date, e); }
        e.orders += r.orders;
        e.revenue += r.revenue;
      }
      console.log(`[baselinker]   id=${sourceId}: ${rows.reduce((s, x) => s + x.orders, 0)} orders, ${rows.reduce((s, x) => s + x.revenue, 0).toFixed(2)} zł`);
    }

    // Upsert one row per date.
    for (const [date, agg] of byDate) {
      await database
        .insert(sellrocketDaily)
        .values({
          date,
          source: bucket,
          orderCount: agg.orders,
          revenue: agg.revenue.toFixed(4),
          avgOrderValue: agg.orders > 0 ? (agg.revenue / agg.orders).toFixed(4) : '0',
        })
        .onConflictDoUpdate({
          target: [sellrocketDaily.date, sellrocketDaily.source],
          set: {
            orderCount: sql`excluded.order_count`,
            revenue: sql`excluded.revenue`,
            avgOrderValue: sql`excluded.avg_order_value`,
            updatedAt: sql`now()`,
          },
        });
      rowsWritten++;
    }
    console.log(`[baselinker]   → ${bucket}: ${byDate.size} days, ${[...byDate.values()].reduce((s, x) => s + x.revenue, 0).toFixed(2)} zł total`);
  }

  // Rebuild 'all' = sum of shr + allegro per day (range-scoped).
  await database.execute(sql`
    INSERT INTO sellrocket_daily (date, source, order_count, revenue, avg_order_value, updated_at)
    SELECT
      date,
      'all',
      SUM(order_count)::int,
      SUM(revenue),
      CASE WHEN SUM(order_count) > 0 THEN SUM(revenue) / SUM(order_count) ELSE 0 END,
      now()
    FROM sellrocket_daily
    WHERE source IN ('shr', 'allegro')
      AND date BETWEEN ${range.start} AND ${range.end}
    GROUP BY date
    ON CONFLICT (date, source) DO UPDATE
    SET order_count = EXCLUDED.order_count,
        revenue = EXCLUDED.revenue,
        avg_order_value = EXCLUDED.avg_order_value,
        updated_at = EXCLUDED.updated_at
  `);

  console.log(`[baselinker] total ${rowsWritten} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { rowsWritten };
}
