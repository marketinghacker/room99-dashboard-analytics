/**
 * GET /api/data/sync-heartbeat
 * Last finished sync_runs row across all sources — used by the Sidebar
 * "sync · 3m temu" chip. Requires login (middleware enforces), no role gate.
 */
import { db } from '@/lib/db';
import { syncRuns } from '@/lib/schema';
import { desc, isNotNull } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await db
    .select({
      source: syncRuns.source,
      status: syncRuns.status,
      finishedAt: syncRuns.finishedAt,
    })
    .from(syncRuns)
    .where(isNotNull(syncRuns.finishedAt))
    .orderBy(desc(syncRuns.finishedAt))
    .limit(1);
  return Response.json({ lastRun: rows[0] ?? null });
}
