/**
 * Quick inspection of Railway Postgres tables.
 */
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const tables = await pool.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' ORDER BY table_name;
`);

console.log('Tables in Railway DB:');
for (const row of tables.rows) {
  const count = await pool.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
  console.log(`  ${row.table_name.padEnd(30)} rows: ${count.rows[0].count}`);
}

await pool.end();
