import { db as defaultDb, type DB } from '@/lib/db';
import { syncRuns } from '@/lib/schema';
import { eq } from 'drizzle-orm';

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
