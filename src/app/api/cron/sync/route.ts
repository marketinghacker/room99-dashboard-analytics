/**
 * POST /api/cron/sync?key=SECRET
 * Orchestrates all platform syncs + rebuilds the rollup cache.
 *
 * Railway cron: `*\/30 * * * *` hits this URL with `CRON_SECRET` as query param.
 * Returns JSON with per-platform status + row counts.
 */
import { syncMeta } from '@/lib/sync/meta';
import { syncGoogleAds } from '@/lib/sync/google-ads';
import { syncCriteo } from '@/lib/sync/criteo';
import { syncGA4 } from '@/lib/sync/ga4';
import { syncPinterest } from '@/lib/sync/pinterest';
import { startRun, finishRun } from '@/lib/sync/run-tracker';
import { resolvePeriod } from '@/lib/periods';
import { buildRollups } from '@/lib/rollup';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min

type Source = 'meta' | 'google_ads' | 'criteo' | 'ga4' | 'pinterest';

async function runWithTracking<T>(
  source: Source,
  fn: () => Promise<{ rowsWritten: number } | T>
): Promise<{ source: Source; status: 'success' | 'failed'; rows?: number; error?: string }> {
  const id = await startRun(source);
  try {
    const out = (await fn()) as { rowsWritten: number };
    await finishRun(id, { status: 'success', rowsWritten: out.rowsWritten });
    return { source, status: 'success', rows: out.rowsWritten };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishRun(id, { status: 'failed', error: msg });
    return { source, status: 'failed', error: msg };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  if (key !== secret) return new Response('Unauthorized', { status: 401 });

  const range = resolvePeriod('last_30d');

  // Run all syncs in parallel; each is independent.
  const results = await Promise.all([
    runWithTracking('meta', () => syncMeta()),
    runWithTracking('google_ads', () => syncGoogleAds(range)),
    runWithTracking('criteo', () => syncCriteo(range)),
    runWithTracking('ga4', () => syncGA4(range)),
    runWithTracking('pinterest', () => syncPinterest(range)),
  ]);

  const rollupStart = Date.now();
  let rollupErr: string | null = null;
  let rollupCount = 0;
  try {
    const out = await buildRollups();
    rollupCount = out.cached;
  } catch (err) {
    rollupErr = err instanceof Error ? err.message : String(err);
  }

  return Response.json({
    ok: results.every((r) => r.status === 'success') && !rollupErr,
    range,
    platforms: results,
    rollup: {
      durationMs: Date.now() - rollupStart,
      cached: rollupCount,
      error: rollupErr,
    },
  });
}

// Also allow POST for Railway's cron preference.
export const POST = GET;
