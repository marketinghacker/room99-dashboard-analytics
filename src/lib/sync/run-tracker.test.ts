/**
 * Integration test for run tracker. Runs against live Railway Postgres.
 * Skipped if DATABASE_URL unset.
 */
import { describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '@/lib/schema';
import { startRun, finishRun } from './run-tracker';

const hasDB = !!process.env.DATABASE_URL;

describe.skipIf(!hasDB)('run-tracker (live DB)', () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('proxy.rlwy.net')
      ? { rejectUnauthorized: false }
      : false,
  });
  const db = drizzle(pool, { schema });

  it('startRun + finishRun roundtrip', async () => {
    const id = await startRun('test-source', db);
    expect(typeof id).toBe('string');

    await finishRun(id, { status: 'success', rowsWritten: 42 }, db);

    const [row] = await db.select().from(schema.syncRuns).where(eq(schema.syncRuns.id, id));
    expect(row.status).toBe('success');
    expect(row.rowsWritten).toBe(42);
    expect(row.finishedAt).toBeInstanceOf(Date);
    expect(row.source).toBe('test-source');

    // cleanup
    await db.delete(schema.syncRuns).where(eq(schema.syncRuns.id, id));
    await pool.end();
  }, 15_000);
});
