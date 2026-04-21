import { db as defaultDb, type DB } from '@/lib/db';
import { syncRuns } from '@/lib/schema';
import { and, eq, lt, sql } from 'drizzle-orm';

export async function startRun(source: string, db: DB = defaultDb): Promise<string> {
  const [row] = await db
    .insert(syncRuns)
    .values({ source, status: 'running' })
    .returning({ id: syncRuns.id });
  return row.id;
}

export async function finishRun(
  id: string,
  opts: { status: 'success' | 'partial' | 'failed'; rowsWritten?: number; error?: string },
  db: DB = defaultDb
): Promise<void> {
  await db
    .update(syncRuns)
    .set({
      status: opts.status,
      rowsWritten: opts.rowsWritten ?? 0,
      error: opts.error ?? null,
      finishedAt: new Date(),
    })
    .where(eq(syncRuns.id, id));
}

/**
 * Reap orphaned `running` runs older than `maxAgeMs`. Happens when Railway
 * kills a function mid-execution (e.g. GA4 SSE hang at 300s maxDuration) —
 * the row never gets `finishedAt` set, so status stays `running` forever.
 *
 * IMPORTANT: only reaps regular `source` rows, not `backfill:*` ones.
 * Backfills can legitimately run 30-60 min (BaseLinker paginates through
 * order_id history for old date ranges), and they enforce their own
 * per-source timeout via withTimeout inside /api/admin/backfill. Reaping
 * them here would fail rows that are still making progress.
 *
 * Called at the start of every cron sync / sync-now to keep the dashboard
 * honest. Returns the number of rows reaped.
 */
export async function reapOrphanedRuns(
  maxAgeMs: number = 10 * 60 * 1000,
  db: DB = defaultDb,
): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const res = await db
    .update(syncRuns)
    .set({
      status: 'failed',
      error: sql`'orphaned: still running after ' || ${Math.floor(maxAgeMs / 1000)} || 's (reaper)'`,
      finishedAt: new Date(),
    })
    .where(
      and(
        eq(syncRuns.status, 'running'),
        lt(syncRuns.startedAt, cutoff),
        // Skip long-running backfills — they manage their own lifecycle.
        sql`${syncRuns.source} NOT LIKE 'backfill:%'`,
      ),
    )
    .returning({ id: syncRuns.id });
  return res.length;
}

/**
 * Race a promise against a hard timeout. When the timeout fires, rejects
 * with a descriptive error — the caller decides how to clean up (close
 * MCP client, mark run failed, etc). Prevents the "running forever" state
 * when an underlying transport (MCP SSE) hangs past sensible bounds.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
