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
import { startRun, finishRun } from '@/lib/sync/run-tracker';
import { resolvePeriod } from '@/lib/periods';
import { buildRollups } from '@/lib/rollup';

export const runtime = 'nodejs';
// Railway raises per-request timeout via proxy settings; keep work under 4 min
// to stay well inside Railway's default 5-min ingress limit.
export const maxDuration = 300;

type Source = 'meta' | 'google_ads' | 'criteo' | 'ga4' | 'pinterest' | 'sellrocket' | 'products';

async function runWithTracking(
  source: Source,
  fn: () => Promise<{ rowsWritten: number }>
): Promise<{ source: Source; status: 'success' | 'failed'; rows?: number; error?: string; ms?: number }> {
  const id = await startRun(source);
  const t0 = Date.now();
  try {
    const out = await fn();
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

  // Ad platforms: last 7 days by default. Meta gets last 30d because Facebook's
  // attribution window keeps updating historical conversion data for ~28 days,
  // so we need to re-pull the full window on every cron to self-heal any
  // earlier bad values (e.g. aggregate-spread fallback from a previous sync).
  // Graph API with time_increment=1 returns clean per-day rows — 30 days is
  // still one API call per campaign so it stays fast.
  const last7 = resolvePeriod('last_7d');
  const last30 = resolvePeriod('last_30d');

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

  return Response.json({
    ok: results.every((r) => r.status === 'success'),
    last7Range: last7,
    last30Range: last30,
    tightRange,
    platforms: results,
    rollup: 'started in background',
  });
}

export const POST = GET;
