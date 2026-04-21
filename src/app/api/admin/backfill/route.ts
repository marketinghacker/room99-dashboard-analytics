/**
 * POST/GET /api/admin/backfill?key=SECRET&start=YYYY-MM-DD&end=YYYY-MM-DD&sources=sellrocket,ga4
 *
 * Fire-and-forget. Starts long-running backfill on the Railway container and
 * returns immediately. Use sync_runs table + /api/admin/sync-status to monitor.
 *
 * Typical use:
 *   curl "https://DOMAIN/api/admin/backfill?key=$CRON_SECRET&start=2026-03-01&end=2026-04-16"
 */
import { syncMetaGraph } from '@/lib/sync/meta-graph';
import { syncGoogleAds } from '@/lib/sync/google-ads';
import { syncCriteo } from '@/lib/sync/criteo';
import { syncGA4 } from '@/lib/sync/ga4';
import { syncPinterest } from '@/lib/sync/pinterest';
import { syncSellRocket } from '@/lib/sync/sellrocket';
import { syncSellRocketDirect } from '@/lib/sync/sellrocket-direct';
import { syncProducts } from '@/lib/sync/products';
import { syncShoperHistorical, syncShoperDailyRevenue } from '@/lib/sync/shoper';
import { startRun, finishRun, withTimeout } from '@/lib/sync/run-tracker';
import { buildRollups } from '@/lib/rollup';
import { type DateRange } from '@/lib/periods';

export const runtime = 'nodejs';
export const maxDuration = 10; // respond quickly; work runs in background

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Backfills can be wide (e.g. full year of BaseLinker orders), so the
// per-source timeout is generous. GA4 is capped tighter — the SSE
// transport hangs rather than fails gracefully when the MCP server has
// issues, and the retry-on-next-backfill pattern is cheaper than
// waiting 15 min for a dead socket.
const BACKFILL_TIMEOUT_MS: Record<string, number> = {
  meta: 15 * 60 * 1000,        // 15 min
  google_ads: 5 * 60 * 1000,
  criteo: 5 * 60 * 1000,
  ga4: 3 * 60 * 1000,
  pinterest: 3 * 60 * 1000,
  // BaseLinker historical ranges walk order-id ASC from the first matching
  // timestamp. For YoY (e.g. 2025-04), that's hundreds of thousands of orders
  // to stream even with the 30-day hard cutoff. Give it 60 min.
  sellrocket: 60 * 60 * 1000,
  products: 60 * 60 * 1000,
  // Shoper direct: two paginations (orders + order-products) at 50/page.
  // A month of Room99 orders (~9k) needs ~500 API calls → ~3-5 min.
  shoper: 30 * 60 * 1000,
  shoper_daily: 15 * 60 * 1000,
};

async function track(source: string, fn: () => Promise<{ rowsWritten: number }>) {
  const id = await startRun(`backfill:${source}`);
  try {
    const out = await withTimeout(
      fn(),
      BACKFILL_TIMEOUT_MS[source] ?? 10 * 60 * 1000,
      `backfill:${source}`,
    );
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

  const sourcesRaw = (url.searchParams.get('sources') ?? 'meta,sellrocket,products,google_ads,criteo,ga4,pinterest,shoper,shoper_daily')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const jobs: Array<{ source: string; fn: () => Promise<{ rowsWritten: number }> }> = [];
  for (const source of sourcesRaw) {
    switch (source) {
      case 'meta':
        // Meta Graph API supports arbitrary ranges via time_range + time_increment=1.
        jobs.push({ source, fn: () => syncMetaGraph(range) });
        break;
      case 'sellrocket':
        // Prefer direct BaseLinker API when token is set — accurate Allegro.
        // Falls back to MCP otherwise.
        jobs.push({
          source,
          fn: () =>
            process.env.BASELINKER_API_TOKEN
              ? syncSellRocketDirect(range)
              : syncSellRocket(range),
        });
        break;
      case 'products':
        jobs.push({ source, fn: () => syncProducts(range) });
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
      case 'shoper':
        // Shoper direct: writes per-SKU rows into products_daily with
        // source='shr'. Use for YoY ranges where BaseLinker has purged
        // its order cache (>365 days).
        jobs.push({ source, fn: () => syncShoperHistorical(range) });
        break;
      case 'shoper_daily':
        // Shoper daily revenue aggregate for the Shoper vs Allegro chart
        // (sellrocket_daily source='shr'). Pair with 'shoper' for full YoY.
        jobs.push({ source, fn: () => syncShoperDailyRevenue(range) });
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
