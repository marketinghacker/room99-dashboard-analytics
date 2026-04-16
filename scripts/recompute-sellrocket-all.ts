/**
 * Recompute `source='all'` rows in sellrocket_daily by summing every other source.
 * Run after any partial backfill where multiple source syncs happen in parallel.
 */
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const [, , start, end] = process.argv;
if (!start || !end) {
  console.error('Usage: recompute-sellrocket-all.ts YYYY-MM-DD YYYY-MM-DD');
  process.exit(1);
}

const res = await pool.query(
  `
  INSERT INTO sellrocket_daily (date, source, order_count, revenue, avg_order_value, updated_at)
  SELECT date, 'all', SUM(order_count)::int, SUM(revenue),
    CASE WHEN SUM(order_count) > 0 THEN SUM(revenue) / SUM(order_count) ELSE 0 END,
    now()
  FROM sellrocket_daily
  WHERE source <> 'all' AND date BETWEEN $1 AND $2
  GROUP BY date
  ON CONFLICT (date, source) DO UPDATE
  SET order_count = EXCLUDED.order_count,
      revenue = EXCLUDED.revenue,
      avg_order_value = EXCLUDED.avg_order_value,
      updated_at = EXCLUDED.updated_at
  RETURNING date, order_count, revenue;
  `,
  [start, end],
);
console.log(`Recomputed ${res.rows.length} 'all' rows (${start}..${end})`);
const totalOrders = res.rows.reduce((s, r) => s + r.order_count, 0);
const totalRev = res.rows.reduce((s, r) => s + Number(r.revenue), 0);
console.log(`Totals: ${totalOrders} orders, ${totalRev.toFixed(2)} zł`);
await pool.end();
