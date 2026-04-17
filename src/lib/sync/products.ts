/**
 * Per-SKU/source/day aggregation from BaseLinker orders.
 *
 * Pulls orders via the direct API (same auth as sellrocket-direct), filters by
 * the user-configured `order_status_config.is_valid_sale`, then sums per
 * (date, sku, source). Categories + collections come from sku-parser.ts.
 */
import { sql, eq } from 'drizzle-orm';
import { db as defaultDb, type DB } from '@/lib/db';
import { productsDaily, orderStatusConfig } from '@/lib/schema';
import { BaseLinkerAPI } from './baselinker-api';
import { parseSkuToCategoryCollection } from './sku-parser';
import { SOURCE_BUCKETS, type Bucket } from './sellrocket-direct';
import { type DateRange } from '@/lib/periods';

type Agg = {
  date: string;
  sku: string;
  productName: string;
  category: string | null;
  collection: string | null;
  source: Bucket;
  quantity: number;
  revenue: number;
  orderIds: Set<number>;
};

export async function syncProducts(
  range: DateRange,
  opts: { db?: DB; buckets?: Bucket[] } = {}
): Promise<{ rowsWritten: number }> {
  const database = opts.db ?? defaultDb;
  const buckets: Bucket[] = opts.buckets ?? ['shr', 'allegro'];

  const token = process.env.BASELINKER_API_TOKEN;
  if (!token) throw new Error('BASELINKER_API_TOKEN missing — set in env');
  const api = new BaseLinkerAPI(token);

  const validRows = await database.select().from(orderStatusConfig).where(eq(orderStatusConfig.isValidSale, true));
  const validSet = new Set(validRows.map((r) => r.statusId));
  console.log(`[products] valid sale statuses: ${validSet.size > 0 ? [...validSet].join(',') : 'none — counting ALL orders'}`);

  const fromTs = Math.floor(new Date(range.start + 'T00:00:00Z').getTime() / 1000);
  const toTs = Math.floor(new Date(range.end + 'T23:59:59Z').getTime() / 1000);

  let rowsWritten = 0;
  const t0 = Date.now();

  // Wipe range first so removed orders disappear from totals on re-sync.
  await database.execute(sql`
    DELETE FROM products_daily
    WHERE date BETWEEN ${range.start} AND ${range.end}
      AND source IN (${sql.join(buckets.map((b) => sql`${b}`), sql`, `)})
  `);

  for (const bucket of buckets) {
    const sources = SOURCE_BUCKETS[bucket];
    const agg = new Map<string, Agg>();

    for (const src of sources) {
      const all = await api.getOrdersRange({ fromTs, toTs, sourceType: src.sourceType, sourceId: src.sourceId });
      const filtered = validSet.size > 0 ? all.filter((o) => validSet.has(o.order_status_id)) : all;
      console.log(`[products] ${bucket} ${src.sourceType}/${src.sourceId}: ${filtered.length}/${all.length} orders kept`);

      for (const o of filtered) {
        const date = new Date(o.date_confirmed * 1000).toISOString().slice(0, 10);
        if (date < range.start || date > range.end) continue; // edge of TZ
        for (const p of o.products ?? []) {
          const sku = (p.sku ?? '').trim() || (p.ean ?? '').trim() || `noname-${(p as any).product_id ?? 'x'}`;
          const key = `${date}|${sku}`;
          let e = agg.get(key);
          if (!e) {
            const parsed = parseSkuToCategoryCollection(p.name ?? '');
            e = {
              date,
              sku,
              productName: p.name ?? '',
              category: parsed.category,
              collection: parsed.collection,
              source: bucket,
              quantity: 0,
              revenue: 0,
              orderIds: new Set<number>(),
            };
            agg.set(key, e);
          }
          e.quantity += Number(p.quantity ?? 0);
          e.revenue += Number(p.price_brutto ?? 0) * Number(p.quantity ?? 0);
          e.orderIds.add(o.order_id);
        }
      }
    }

    // Bulk insert per bucket
    const rows = Array.from(agg.values()).map((e) => ({
      date: e.date,
      sku: e.sku,
      productName: e.productName,
      category: e.category,
      collection: e.collection,
      source: e.source,
      quantity: e.quantity,
      revenue: e.revenue.toFixed(4),
      orders: e.orderIds.size,
    }));

    // Batch in chunks of 200 to keep query size sane
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      if (slice.length === 0) continue;
      await database.insert(productsDaily).values(slice).onConflictDoUpdate({
        target: [productsDaily.date, productsDaily.sku, productsDaily.source],
        set: {
          productName: sql`excluded.product_name`,
          category: sql`excluded.category`,
          collection: sql`excluded.collection`,
          quantity: sql`excluded.quantity`,
          revenue: sql`excluded.revenue`,
          orders: sql`excluded.orders`,
          updatedAt: sql`now()`,
        },
      });
      rowsWritten += slice.length;
    }
  }

  console.log(`[products] total ${rowsWritten} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { rowsWritten };
}
