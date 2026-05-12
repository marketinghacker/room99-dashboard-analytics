import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as schema from '@/lib/schema';

export type TestDB = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Starts an ephemeral Postgres container, applies all Drizzle migrations, returns a
 * Drizzle client bound to it. Requires Docker.
 */
export async function startTestDB(): Promise<{
  container: StartedPostgreSqlContainer;
  pool: Pool;
  db: TestDB;
  stop: () => Promise<void>;
}> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const pool = new Pool({ connectionString: container.getConnectionUri() });
  const db = drizzle(pool, { schema });

  // Apply raw SQL migrations (same path as prod bootstrap).
  const files = readdirSync('./drizzle').filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = readFileSync(join('./drizzle', file), 'utf-8');
    const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      if (stmt.startsWith('--')) continue;
      await pool.query(stmt);
    }
  }

  return {
    container,
    pool,
    db,
    stop: async () => {
      await pool.end();
      await container.stop();
    },
  };
}

/**
 * Detects whether Docker is available before spinning up a container.
 * Use with `describe.skipIf(!await isDockerAvailable())` in tests that need it.
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    const { execSync } = await import('node:child_process');
    execSync('docker info', { stdio: 'ignore', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}
