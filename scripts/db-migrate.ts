/**
 * Apply migration SQL directly to Railway Postgres (idempotent via IF NOT EXISTS).
 * Used once at bootstrap; later we switch to drizzle-kit migrate.
 */
import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('proxy.rlwy.net')
    ? { rejectUnauthorized: false }
    : false,
});

const files = readdirSync('./drizzle').filter(f => f.endsWith('.sql')).sort();

for (const file of files) {
  console.log(`\nApplying ${file}...`);
  const sql = readFileSync(join('./drizzle', file), 'utf-8');
  const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      console.log('  ✓', stmt.split('\n')[0].slice(0, 80));
    } catch (err: any) {
      console.error('  ✗', stmt.split('\n')[0].slice(0, 80));
      console.error('    ', err.message);
      throw err;
    }
  }
}

console.log('\n✓ All migrations applied');
await pool.end();
