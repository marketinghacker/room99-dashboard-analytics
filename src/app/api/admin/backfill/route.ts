/**
 * POST/GET /api/admin/backfill?key=SECRET&start=YYYY-MM-DD&end=YYYY-MM-DD&sources=sellrocket,ga4
 *
 * Fire-and-forget. Starts long-running backfill on the Railway container and
 * returns immediately. Use sync_runs table + /api/admin/sync-status to monitor.
 *
 * Typical use:
 *   curl "https://DOMAIN/api/admin/backfill?key=$CRON_SECRET&start=2026-03-01&end=2026-04-16"
 */
import { syncGoogleAds } from '@/lib/sync/google-ads';
import { syncCriteo } from '@/lib/sync/criteo';
import { syncGA4 } from '@/lib/sync/ga4';
import { syncPinterest } from '@/lib/sync/pinterest';
import { syncSellRocket } from '@/lib/sync/sellrocket';
import { startRun, finishRun } from '@/lib/sync/run-tracker';
import { buildRollups } from '@/lib/rollup';
import { type DateRange } from '@/lib/periods';

export const runtime = 'nodejs';
export const maxDuration = 10; // respond quickly; work runs in background

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function track(source: string, fn: () => Promise<{ rowsWritten: number }>) {
  const id = await startRun(`backfill:${source}`);
  try {
    const out = await fn();
    await finishRun(id, { status: 'success', rowsWritten: out.rowsWritten });
    console.log(`[backfill] ${source}: ${out.rowsWritten} rows`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishRun(id, { status: 'failed', error: msg });
    console.error(`[backfill] ${source} failed:`, msg);
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  if (key !== secret) return new Response('Unauthorized', { status: 401 });

  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (!start || !end || !ISO_DATE.test(start) || !ISO_DATE.test(end)) {
    return Response.json(
      { error: 'Required: start=YYYY-MM-DD & end=YYYY-MM-DD' },
      { status: 400 },
    );
  }
  const range: DateRange = { start, end };

  const sourcesRaw = (url.searchParams.get('sources') ?? 'sellrocket,google_ads,criteo,ga4,pinterest')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const jobs: Array<{ source: string; fn: () => Promise<{ rowsWritten: number }> }> = [];
  for (const source of sourcesRaw) {
    switch (source) {
      case 'sellrocket':
        jobs.push({ source, fn: () => syncSellRocket(range) });
        break;
      case 'google_ads':
        jobs.push({ source, fn: () => syncGoogleAds(range) });
        break;
      case 'criteo':
        jobs.push({ source, fn: () => syncCriteo(range) });
        break;
      case 'ga4':
        jobs.push({ source, fn: () => syncGA4(range) });
        break;
      case 'pinterest':
        jobs.push({ source, fn: () => syncPinterest(range) });
        break;
      default:
        // ignore unknown
        break;
    }
  }

  // Fire-and-forget: kick off everything, rebuild rollups after.
  // `void` so we don't await — HTTP response returns immediately.
  void (async () => {
    console.log(`[backfill] starting ${jobs.length} jobs for ${start}..${end}`);
    await Promise.all(jobs.map((j) => track(j.source, j.fn)));
    console.log('[backfill] all syncs done, rebuilding rollups');
    try {
      const out = await buildRollups();
      console.log(`[backfill] rollup complete: ${out.cached} entries`);
    } catch (err) {
      console.error('[backfill] rollup failed:', err);
    }
  })();

  return Response.json({
    ok: true,
    started: new Date().toISOString(),
    range,
    sources: jobs.map((j) => j.source),
    note: 'Fire-and-forget. Monitor via /api/admin/sync-status',
  });
}

export const POST = GET;
