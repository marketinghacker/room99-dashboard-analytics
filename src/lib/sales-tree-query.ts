import { db } from './db';
import { sql } from 'drizzle-orm';
import type { FlatRow } from './sales-tree';

export type FetchOptions = {
  start: string; end: string;
  compareStart: string; compareEnd: string;
  channels: string[]; // e.g. ['shr', 'allegro']
};

/**
 * Aggregate `products_daily` into one flat row per (source, sku) for the given
 * current period, with a parallel daily-revenue array (length = period days)
 * and a scalar revenue total for the compare period.
 *
 * The rollup runs entirely in Postgres via a CTE so the page can render the
 * full Source -> Category -> Collection -> SKU tree (with sparklines and
 * period-over-period deltas) in a single query.
 *
 * Notes:
 * - We exclude `source = 'all'` implicitly by passing an explicit channel list
 *   (typically `['shr', 'allegro']`) — 'all' is a BaseLinker rollup we never
 *   want to double-count alongside the per-source rows.
 * - Dates are compared in `Europe/Warsaw` because the dashboard is operated
 *   from PL hours; rows stored at midnight UTC for the previous PL day would
 *   otherwise straddle the boundary.
 */
export async function fetchSalesTreeRows(opts: FetchOptions): Promise<FlatRow[]> {
  const channelList = opts.channels.length > 0 ? opts.channels : ['shr', 'allegro'];
  const channelIn = sql.join(channelList.map((c) => sql`${c}`), sql`, `);

  // CTE plan:
  // 1. `dates` — generate_series for each day in current period
  // 2. `keys` — distinct (source, category, collection, sku, product_name)
  //    that appeared in EITHER current or compare period
  // 3. `current_daily` — keys × dates LEFT JOIN actual rows, so missing days = 0
  // 4. `current_agg` — sum + array_agg ordered by day
  // 5. `prev_agg` — sum revenue for compare period per (source, sku)
  // Final: join current_agg to prev_agg, drop rows that are zero in both periods
  const result = await db.execute(sql`
    WITH dates AS (
      SELECT generate_series(
        ${opts.start}::date,
        ${opts.end}::date,
        '1 day'::interval
      )::date AS d
    ),
    keys AS (
      SELECT DISTINCT source, category, collection, sku, product_name
      FROM products_daily
      WHERE source IN (${channelIn})
        AND ((date AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${opts.start}::date AND ${opts.end}::date
          OR (date AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${opts.compareStart}::date AND ${opts.compareEnd}::date)
    ),
    current_daily AS (
      SELECT k.source, k.category, k.collection, k.sku, k.product_name, d.d AS day,
             COALESCE(SUM(p.revenue::numeric), 0)::float8 AS revenue,
             COALESCE(SUM(p.quantity), 0)::int AS quantity,
             COALESCE(SUM(p.orders), 0)::int AS orders
      FROM keys k
      CROSS JOIN dates d
      LEFT JOIN products_daily p
        ON p.source = k.source AND p.sku = k.sku
        AND (p.date AT TIME ZONE 'Europe/Warsaw')::date = d.d
      GROUP BY k.source, k.category, k.collection, k.sku, k.product_name, d.d
    ),
    current_agg AS (
      SELECT source, category, collection, sku, product_name,
             SUM(revenue) AS revenue,
             SUM(quantity) AS quantity,
             SUM(orders) AS orders,
             ARRAY_AGG(revenue ORDER BY day) AS daily
      FROM current_daily
      GROUP BY source, category, collection, sku, product_name
    ),
    prev_agg AS (
      SELECT source, sku,
             COALESCE(SUM(revenue::numeric), 0)::float8 AS revenue_prev
      FROM products_daily
      WHERE source IN (${channelIn})
        AND (date AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${opts.compareStart}::date AND ${opts.compareEnd}::date
      GROUP BY source, sku
    )
    SELECT
      c.source, c.category, c.collection, c.sku, c.product_name,
      c.revenue, c.quantity, c.orders, c.daily,
      COALESCE(p.revenue_prev, 0) AS revenue_prev
    FROM current_agg c
    LEFT JOIN prev_agg p ON p.source = c.source AND p.sku = c.sku
    WHERE c.revenue > 0 OR p.revenue_prev > 0
  `);

  type Row = {
    source: string; category: string | null; collection: string | null; sku: string; product_name: string | null;
    revenue: string | number; quantity: number; orders: number;
    daily: number[] | null; revenue_prev: string | number;
  };
  const raw = (result as unknown as { rows: Row[] }).rows;
  return raw.map(r => ({
    source: r.source,
    category: r.category ?? 'BEZ KATEGORII',
    collection: r.collection ?? 'BEZ KOLEKCJI',
    sku: r.sku,
    product_name: r.product_name ?? r.sku,
    revenue: Number(r.revenue),
    quantity: Number(r.quantity),
    orders: Number(r.orders),
    revenue_prev: Number(r.revenue_prev),
    daily: (r.daily ?? []).map(Number),
  }));
}
