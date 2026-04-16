import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const res = await pool.query(`
  SELECT period_key, platform, compare_key,
    payload->'kpis'->>'spend' AS spend,
    payload->'kpis'->>'revenue' AS revenue,
    payload->'kpis'->>'sessions' AS sessions,
    jsonb_array_length(payload->'campaigns') AS campaign_count,
    jsonb_array_length(payload->'timeSeries') AS days
  FROM dashboard_cache
  WHERE period_key = 'last_30d' AND compare_key = 'previous_period'
  ORDER BY platform;
`);
console.table(res.rows);

await pool.end();
