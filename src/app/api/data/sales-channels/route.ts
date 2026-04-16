/**
 * GET /api/data/sales-channels
 * Returns SellRocket breakdown: Shoper vs Allegro vs Other by day + totals.
 */
import { parseFilters, jsonResponse, errorResponse } from '@/lib/api';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { resolvePeriod } from '@/lib/periods';
import { getCached } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { period, compare } = parseFilters(req);
  const range = resolvePeriod(period);

  // Per-day sellrocket by source.
  const ts: any = await db.execute(sql`
    SELECT
      date::text AS date,
      COALESCE(SUM(CASE WHEN source = 'shr' THEN revenue END), 0)::float AS "revenueShr",
      COALESCE(SUM(CASE WHEN source = 'allegro' THEN revenue END), 0)::float AS "revenueAllegro",
      COALESCE(SUM(CASE WHEN source = 'all' THEN revenue END), 0)::float AS "revenueAll",
      COALESCE(SUM(CASE WHEN source = 'shr' THEN order_count END), 0)::int AS "ordersShr",
      COALESCE(SUM(CASE WHEN source = 'allegro' THEN order_count END), 0)::int AS "ordersAllegro",
      COALESCE(SUM(CASE WHEN source = 'all' THEN order_count END), 0)::int AS "ordersAll"
    FROM sellrocket_daily
    WHERE date BETWEEN ${range.start} AND ${range.end}
    GROUP BY date
    ORDER BY date ASC
  `);
  const rows = (ts.rows ?? ts) as Array<any>;
  const timeSeries = rows.map((r) => ({
    date: r.date,
    revenueShr: Number(r.revenueShr),
    revenueAllegro: Number(r.revenueAllegro),
    revenueAll: Number(r.revenueAll),
    revenueOther: Math.max(0, Number(r.revenueAll) - Number(r.revenueShr) - Number(r.revenueAllegro)),
    ordersShr: Number(r.ordersShr),
    ordersAllegro: Number(r.ordersAllegro),
    ordersOther: Math.max(0, Number(r.ordersAll) - Number(r.ordersShr) - Number(r.ordersAllegro)),
  }));

  // Use the cached rollup for salesBySource aggregate.
  const cached = await getCached('all', period, compare);
  if (!cached) return errorResponse('No cache — run /api/cron/sync', 503);

  return jsonResponse({
    period,
    compare,
    range,
    salesBySource: cached.salesBySource,
    timeSeries,
  });
}
