/**
 * Quick overview of sellrocket_daily: which dates/sources are covered.
 */
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const res = await pool.query(`
  SELECT
    source,
    COUNT(*) FILTER (WHERE revenue > 0) AS nonzero_days,
    COUNT(*) AS total_rows,
    MIN(date) FILTER (WHERE revenue > 0) AS min_date,
    MAX(date) FILTER (WHERE revenue > 0) AS max_date,
    SUM(revenue)::float AS total_revenue,
    SUM(order_count)::int AS total_orders
  FROM sellrocket_daily
  GROUP BY source
  ORDER BY source;
`);

console.log('SellRocket data state:');
console.table(res.rows);

console.log('\nMissing dates in 2026-03-01..2026-04-16 range:');
const missing = await pool.query(`
  WITH dates AS (
    SELECT generate_series('2026-03-01'::date, '2026-04-16'::date, '1 day')::date AS d
  ),
  srcs AS (SELECT unnest(ARRAY['shr', 'allegro']) AS source)
  SELECT
    dates.d AS date,
    srcs.source,
    CASE WHEN sd.revenue > 0 THEN 'ok' ELSE 'MISSING' END AS status
  FROM dates
  CROSS JOIN srcs
  LEFT JOIN sellrocket_daily sd ON sd.date = dates.d AND sd.source = srcs.source
  WHERE sd.revenue IS NULL OR sd.revenue = 0
  ORDER BY dates.d, srcs.source;
`);
console.log(`  ${missing.rows.length} missing (date, source) pairs`);
if (missing.rows.length > 0 && missing.rows.length <= 40) {
  console.table(missing.rows);
} else if (missing.rows.length > 0) {
  console.log('  first 10:', missing.rows.slice(0, 10));
  console.log('  last 10:', missing.rows.slice(-10));
}

await pool.end();
