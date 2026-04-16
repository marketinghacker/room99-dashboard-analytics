import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const res = await pool.query(`
  SELECT date, order_count, revenue::float, avg_order_value::float
  FROM sellrocket_daily
  ORDER BY date DESC
  LIMIT 10;
`);
console.table(res.rows);
const sum = await pool.query(`
  SELECT
    SUM(order_count) AS total_orders,
    SUM(revenue)::float AS total_revenue,
    AVG(avg_order_value)::float AS avg_aov
  FROM sellrocket_daily
  WHERE date >= CURRENT_DATE - INTERVAL '30 days';
`);
console.log('\n30-day totals:');
console.table(sum.rows);
await pool.end();
