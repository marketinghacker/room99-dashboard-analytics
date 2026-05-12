/**
 * GET /api/data/sync-heartbeat
 *
 * Returns the LAST FINISHED sync_runs row per source — feeds the SyncStatus
 * badge in Topbar (per-tab freshness) and the legacy Sidebar chip.
 *
 * Shape:
 *   {
 *     // most-recent row across ALL sources (legacy — Sidebar chip uses this).
 *     lastRun: { source, status, finishedAt } | null,
 *     // most-recent row PER source — used by per-tab SyncStatus.
 *     bySource: Array<{ source, status, finishedAt }>
 *   }
 *
 * Filters out backfill:* rows because those run on operator demand, not on
 * the cron schedule, and would mislead "is the data fresh right now".
 *
 * Requires login (proxy enforces). No role gate.
 */
import { db } from '@/lib/db';
import { syncRuns } from '@/lib/schema';
import { desc, isNotNull, and, sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = { source: string; status: string; finishedAt: string };

export async function GET() {
  const rows = await db
    .select({
      source: syncRuns.source,
      status: syncRuns.status,
      finishedAt: syncRuns.finishedAt,
    })
    .from(syncRuns)
    .where(
      and(
        isNotNull(syncRuns.finishedAt),
        // Don't conflate operator backfills with cron-driven freshness.
        sql`${syncRuns.source} NOT LIKE 'backfill:%'`,
      ),
    )
    .orderBy(desc(syncRuns.finishedAt))
    // Cap at a sensible number — there are only ~7 sources, so 200 rows is
    // plenty to find the latest of each. Keeps the query bounded.
    .limit(200);

  // Reduce to most-recent per source. We sorted DESC, so first wins.
  const seen = new Set<string>();
  const bySource: Row[] = [];
  for (const r of rows) {
    if (!r.finishedAt) continue;
    if (seen.has(r.source)) continue;
    seen.add(r.source);
    bySource.push({
      source: r.source,
      status: r.status,
      finishedAt: r.finishedAt instanceof Date
        ? r.finishedAt.toISOString()
        : String(r.finishedAt),
    });
  }

  const lastRun = bySource[0] ?? null;

  return Response.json({ lastRun, bySource });
}
