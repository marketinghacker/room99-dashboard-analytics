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
import { sql, eq } from 'drizzle-orm';
import { db as defaultDb, type DB } from '@/lib/db';
import { sellrocketDaily, orderStatusConfig } from '@/lib/schema';
import { BaseLinkerAPI, orderRevenue } from './baselinker-api';
import { type DateRange } from '@/lib/periods';

/**
 * Logical buckets mapped to BaseLinker order_source_id(s).
 * Extend as new Allegro sub-accounts appear in BaseLinker.
 */
export const SOURCE_BUCKETS: Record<'shr' | 'allegro', Array<{ sourceType: string; sourceId: number }>> = {
  shr:     [{ sourceType: 'SHR', sourceId: 9 }],         // Room99.pl Shoper
  allegro: [                                             // both ALLEGRO category ('ALL')
    { sourceType: 'ALL', sourceId: 8 },                  // Room99_Official
    { sourceType: 'ALL', sourceId: 7 },                  // e_homeconcept
  ],
};

export type Bucket = keyof typeof SOURCE_BUCKETS;

/**
 * Bucket-specific order status excludes — applied IN ADDITION to the global
 * order_status_config allow-list. Empirically derived from matching the
 * SellRocket UI convention:
 *
 *   - Allegro: exclude in-transit / awaiting / cancelled / intermediate WMS
 *     statuses. Matching Apr 2026 ref number (916,031 zł) required dropping
 *     these 11 statuses; keeping them pushed us 7% over.
 *   - SHR: no bucket-specific excludes (Shoper flow reports all paid orders
 *     regardless of delivery state).
 *
 * If a status belongs on the global invalid list (returns, refunds), configure
 * it via /admin/statuses — this set is for source-specific workflow status
 * quirks that Shoper and Allegro don't share.
 */
export const BUCKET_STATUS_EXCLUDES: Record<Bucket, ReadonlySet<number>> = {
  shr: new Set<number>(),
  allegro: new Set<number>([
    2223,   // W drodze (in transit — not yet counted as sale by SellRocket UI)
    2224,   // Oczekuje w punkcie (awaiting pickup)
    2226,   // Niedoręczone (not delivered)
    2229,   // Anulowane (cancelled)
    137523, // Aktualizuj ZK (triggers; observed data anomaly)
    147785, // WERYFIKACJA SMS (pending verification)
    1666,   // Oczekuje Allegro (awaiting Allegro)
    30035,  // Błąd Wysyłka (shipping error)
    144920, // WMS Skompletowane (intermediate warehouse step)
    144918, // WMS Zaalokowane (intermediate warehouse step)
    111527, // BRAKI (shortage)
  ]),
};

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

  const validRows = await database.select().from(orderStatusConfig).where(eq(orderStatusConfig.isValidSale, true));
  const validSet = new Set(validRows.map((r) => r.statusId));
  console.log(`[baselinker] valid sale statuses: ${validSet.size > 0 ? [...validSet].join(',') : 'none — counting ALL orders'}`);

  for (const bucket of buckets) {
    const sources = SOURCE_BUCKETS[bucket];
    const bucketExcludes = BUCKET_STATUS_EXCLUDES[bucket];
    console.log(`[baselinker] bucket=${bucket} sources=${JSON.stringify(sources)} range=${range.start}..${range.end} bucketExcludes=${bucketExcludes.size}`);

    // Sum across source ids within the bucket.
    const byDate = new Map<string, { orders: number; revenue: number }>();
    for (const src of sources) {
      const fromTs = Math.floor(new Date(range.start + 'T00:00:00Z').getTime() / 1000);
      const toTs = Math.floor(new Date(range.end + 'T23:59:59Z').getTime() / 1000);
      const allOrders = await api.getOrdersRange({
        fromTs, toTs, sourceType: src.sourceType, sourceId: src.sourceId,
      });
      const statusAllowed = validSet.size > 0
        ? allOrders.filter((o) => validSet.has(o.order_status_id))
        : allOrders;
      const filtered = bucketExcludes.size > 0
        ? statusAllowed.filter((o) => !bucketExcludes.has(o.order_status_id))
        : statusAllowed;

      for (const o of filtered) {
        const d = new Date(o.date_confirmed * 1000).toISOString().slice(0, 10);
        // skip if outside range (timezone edge)
        if (d < range.start || d > range.end) continue;
        let e = byDate.get(d);
        if (!e) { e = { orders: 0, revenue: 0 }; byDate.set(d, e); }
        e.orders += 1;
        e.revenue += orderRevenue(o);
      }
      console.log(`[baselinker]   ${src.sourceType}/${src.sourceId}: ${filtered.length}/${allOrders.length} orders kept after status filter`);
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
