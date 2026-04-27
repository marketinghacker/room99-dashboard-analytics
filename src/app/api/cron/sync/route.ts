/**
 * POST/GET /api/cron/sync?key=SECRET
 *
 * Railway cron runs every 30 min. Keeps last 3 days fresh across all platforms.
 * Fast (<3 min total) by scoping to a tight date window and running platforms
 * in parallel. Rollup runs after sync, also in parallel.
 *
 * For longer ranges (initial backfill, historical repair) use
 * /api/admin/backfill which is fire-and-forget (non-blocking).
 */
import { syncMetaGraph } from '@/lib/sync/meta-graph';
import { syncGoogleAds } from '@/lib/sync/google-ads';
import { syncCriteo } from '@/lib/sync/criteo';
import { syncGA4 } from '@/lib/sync/ga4';
import { syncPinterest } from '@/lib/sync/pinterest';
import { syncSellRocket } from '@/lib/sync/sellrocket';
import { syncSellRocketDirect } from '@/lib/sync/sellrocket-direct';
import { syncProducts } from '@/lib/sync/products';
import { startRun, finishRun, reapOrphanedRuns, withTimeout } from '@/lib/sync/run-tracker';
import { db } from '@/lib/db';
import { syncRuns } from '@/lib/schema';
import { and, desc, eq } from 'drizzle-orm';
import { buildRollups } from '@/lib/rollup';

export const runtime = 'nodejs';
// Railway raises per-request timeout via proxy settings; keep work under 4 min
// to stay well inside Railway's default 5-min ingress limit.
export const maxDuration = 300;

type Source = 'meta' | 'google_ads' | 'criteo' | 'ga4' | 'pinterest' | 'sellrocket' | 'products';

// Per-source hard timeout. The cron container's maxDuration is 300s total,
// so each source gets a slice well inside that. Generous for Meta Graph
// (pulls 30d), tighter for GA4 (SSE transport occasionally hangs).
const SOURCE_TIMEOUT_MS: Record<Source, number> = {
  meta: 150_000,
  google_ads: 60_000,
  criteo: 60_000,
  ga4: 60_000,
  pinterest: 30_000,
  sellrocket: 120_000,
  products: 60_000,
};

async function runWithTracking(
  source: Source,
  fn: () => Promise<{ rowsWritten: number }>
): Promise<{ source: Source; status: 'success' | 'failed'; rows?: number; error?: string; ms?: number }> {
  const id = await startRun(source);
  const t0 = Date.now();
  try {
    const out = await withTimeout(fn(), SOURCE_TIMEOUT_MS[source], `sync ${source}`);
    await finishRun(id, { status: 'success', rowsWritten: out.rowsWritten });
    return { source, status: 'success', rows: out.rowsWritten, ms: Date.now() - t0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishRun(id, { status: 'failed', error: msg });
    return { source, status: 'failed', error: msg, ms: Date.now() - t0 };
  }
}

function toIsoDate(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  if (key !== secret) return new Response('Unauthorized', { status: 401 });

  // Throttle: skip when a sync finished successfully within the last 25 min.
  // Ad-platform data doesn't move fast enough to warrant a 5-minute cadence,
  // and every extra run burns one round of Meta Graph flake risk. The
  // external Railway cron-sync container fires every 5 min; this guards the
  // endpoint so actual work runs every ~25-30 min regardless of schedule.
  // Pass ?force=1 to bypass (manual /api/sync-now already skips this).
  const force = url.searchParams.get('force') === '1';
  if (!force) {
    const [recent] = await db
      .select({ finishedAt: syncRuns.finishedAt })
      .from(syncRuns)
      .where(and(eq(syncRuns.source, 'meta'), eq(syncRuns.status, 'success')))
      .orderBy(desc(syncRuns.finishedAt))
      .limit(1);
    if (recent?.finishedAt) {
      const ageMs = Date.now() - new Date(recent.finishedAt).getTime();
      const THROTTLE_MS = 25 * 60 * 1000;
      if (ageMs < THROTTLE_MS) {
        return Response.json({
          ok: true,
          throttled: true,
          lastSuccessAgeMs: ageMs,
          skippedBecause: `last successful meta sync ${Math.round(ageMs / 1000)}s ago (< ${THROTTLE_MS / 1000}s)`,
        });
      }
    }
  }

  // Reap orphaned runs from previous invocations before we start new ones.
  // A Railway function kill (maxDuration=300) leaves sync_runs rows stuck on
  // status='running' — this marks anything >10 min old as 'failed' so the
  // dashboard doesn't mislead on sync health.
  const reaped = await reapOrphanedRuns(10 * 60 * 1000);

  // Ad platforms: last 7 days INCLUDING today. The default `last_7d` preset
  // ends at yesterday-UTC, which excludes 99% of the current Polish day
  // (Apr 27 PL = Apr 26 22:00 UTC → Apr 27 22:00 UTC; yesterday-UTC ends at
  // Apr 27 02:00 PL). For ad platforms that update intraday (Google Ads,
  // Meta, Criteo, Pinterest) we want the partial today-data, so we extend
  // end to today-UTC.
  //
  // Meta gets last 30d because Facebook's attribution window keeps updating
  // historical conversion data for ~28 days, so we need to re-pull the full
  // window on every cron to self-heal any earlier bad values.
  const last7 = { start: toIsoDate(-7), end: toIsoDate(0) };   // 8 days incl. today
  const last30 = { start: toIsoDate(-29), end: toIsoDate(0) }; // 30 days incl. today

  // SellRocket + products are the BaseLinker-heavy syncs — only pull the
  // tightest window needed. Historical repair goes through /api/admin/backfill.
  const tightRange = { start: toIsoDate(-2), end: toIsoDate(0) };

  const results = await Promise.all([
    runWithTracking('meta', () => syncMetaGraph(last30)),
    runWithTracking('google_ads', () => syncGoogleAds(last7)),
    runWithTracking('criteo', () => syncCriteo(last7)),
    runWithTracking('ga4', () => syncGA4(last7)),
    runWithTracking('pinterest', () => syncPinterest(last7)),
    runWithTracking(
      'sellrocket',
      process.env.BASELINKER_API_TOKEN
        ? () => syncSellRocketDirect(tightRange)
        : () => syncSellRocket(tightRange),
    ),
    // Products + products_daily — today's categories/SKUs need to be fresh
    // so the Produkty tab never shows empty-state mid-day.
    runWithTracking('products', () => syncProducts(tightRange)),
  ]);

  // Rollup is CPU/DB-bound (~8 min for 234 cache rows). Run in background so
  // the cron request returns fast. The Next.js container keeps the event loop
  // alive until the Promise settles.
  const rollupPromise = buildRollups()
    .then((out) => console.log(`[cron] rollup: ${out.cached} entries cached`))
    .catch((err) => console.error('[cron] rollup failed:', err));
  void rollupPromise;

  // `ok` flag policy: the external cron-sync container treats ok=false as
  // exit-code-1 which shows up as a "Deploy Crashed" email. Meta Graph API
  // flakes out randomly (500/OAuth "Service temporarily unavailable") and
  // recovers on the next run — that's NOT a crash. Mark the sync as OK as
  // long as most platforms succeeded (≥50%, with Shoper-facing critical
  // ones — sellrocket + products — required). Catastrophic failures (0%
  // success, DB down, etc) still flag ok=false so real outages alert.
  const successes = results.filter((r) => r.status === 'success').length;
  const successRatio = successes / results.length;
  const criticalFailed = results.some(
    (r) => r.status === 'failed' && (r.source === 'sellrocket' || r.source === 'products'),
  );
  const ok = !criticalFailed && successRatio >= 0.5;

  return Response.json({
    ok,
    last7Range: last7,
    last30Range: last30,
    tightRange,
    platforms: results,
    rollup: 'started in background',
    reapedOrphanedRuns: reaped,
    // Diagnostic so the cron-sync log line is self-documenting when a
    // platform blipped but the run is still considered healthy.
    degraded: !results.every((r) => r.status === 'success'),
    successRatio,
  });
}

export const POST = GET;
