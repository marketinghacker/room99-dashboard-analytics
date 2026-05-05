/**
 * POST /api/sync-yoy?start=YYYY-MM-DD&end=YYYY-MM-DD — agency-only YoY backfill.
 *
 * Mirrors `/api/admin/backfill?sources=shoper,shoper_daily` but authenticated
 * via JWT (agency role) instead of CRON_SECRET. Lets the dashboard UI offer
 * a "Pociągnij dane YoY" button when products_daily has no rows for a YoY
 * range — no need for the user to copy-paste a curl command.
 *
 * Fire-and-forget: returns immediately, work runs in background. Poll
 * /api/admin/sync-status?key=… or just refetch /api/data/top-products
 * after ~3-5 minutes.
 */
import { syncShoperHistorical, syncShoperDailyRevenue } from '@/lib/sync/shoper';
import { startRun, finishRun, withTimeout } from '@/lib/sync/run-tracker';
import { buildRollups } from '@/lib/rollup';
import type { DateRange } from '@/lib/periods';

export const runtime = 'nodejs';
export const maxDuration = 10; // respond fast; sync runs in background

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Same generous per-source timeouts as /api/admin/backfill so a slow Shoper
// API call can't strand a `running` row.
const TIMEOUTS = {
  shoper: 30 * 60 * 1000,
  shoper_daily: 15 * 60 * 1000,
};

async function track(source: string, fn: () => Promise<{ rowsWritten: number }>) {
  const id = await startRun(`backfill:${source}`);
  try {
    const out = await withTimeout(
      fn(),
      TIMEOUTS[source as keyof typeof TIMEOUTS] ?? 10 * 60 * 1000,
      `backfill:${source}`,
    );
    await finishRun(id, { status: 'success', rowsWritten: out.rowsWritten });
    console.log(`[sync-yoy] ${source}: ${out.rowsWritten} rows`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishRun(id, { status: 'failed', error: msg });
    console.error(`[sync-yoy] ${source} failed:`, msg);
  }
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');

  if (!start || !end || !ISO_DATE.test(start) || !ISO_DATE.test(end)) {
    return Response.json(
      { error: 'Required: start=YYYY-MM-DD & end=YYYY-MM-DD' },
      { status: 400 },
    );
  }

  // Sanity guard: refuse absurd ranges that would hog API budget for hours.
  const startMs = Date.parse(start + 'T00:00:00Z');
  const endMs = Date.parse(end + 'T00:00:00Z');
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return Response.json({ error: 'Invalid range' }, { status: 400 });
  }
  const days = Math.ceil((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
  if (days > 95) {
    return Response.json(
      { error: `Range too wide (${days} days). Max 95 days per call.` },
      { status: 400 },
    );
  }

  const range: DateRange = { start, end };

  void (async () => {
    console.log(`[sync-yoy] starting shoper + shoper_daily for ${start}..${end}`);
    await Promise.all([
      track('shoper', () => syncShoperHistorical(range)),
      track('shoper_daily', () => syncShoperDailyRevenue(range)),
    ]);
    console.log('[sync-yoy] syncs done, rebuilding rollups');
    try {
      const out = await buildRollups();
      console.log(`[sync-yoy] rollup complete: ${out.cached} entries`);
    } catch (err) {
      console.error('[sync-yoy] rollup failed:', err);
    }
  })();

  return Response.json({
    ok: true,
    started: new Date().toISOString(),
    range,
    sources: ['shoper', 'shoper_daily'],
    note: 'Fire-and-forget. Refresh /api/data/top-products in ~3-5 minutes.',
  });
}
