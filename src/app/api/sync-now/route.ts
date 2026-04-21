/**
 * POST /api/sync-now — agency-only manual sync trigger.
 * Mirrors /api/cron/sync but authenticated via JWT instead of CRON_SECRET.
 * Fire-and-forget: returns immediately, work happens in background.
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
export const maxDuration = 10;

function toIsoDate(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function track(source: string, fn: () => Promise<{ rowsWritten: number }>) {
  const id = await startRun(source);
  try {
    const out = await fn();
    await finishRun(id, { status: 'success', rowsWritten: out.rowsWritten });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishRun(id, { status: 'failed', error: msg });
  }
}

export async function POST() {
  const last7 = resolvePeriod('last_7d');
  const last30 = resolvePeriod('last_30d');
  // Tight 3-day window for the BaseLinker-heavy syncs (sellrocket + products).
  const tightRange = { start: toIsoDate(-2), end: toIsoDate(0) };

  // Fire-and-forget — caller gets an immediate OK.
  void (async () => {
    await Promise.all([
      track('meta',       () => syncMetaGraph(last30)),
      track('google_ads', () => syncGoogleAds(last7)),
      track('criteo',     () => syncCriteo(last7)),
      track('ga4',        () => syncGA4(last7)),
      track('pinterest',  () => syncPinterest(last7)),
      track('sellrocket', () =>
        process.env.BASELINKER_API_TOKEN
          ? syncSellRocketDirect(tightRange)
          : syncSellRocket(tightRange),
      ),
      // Products is the other expensive BaseLinker sync — keep it to the
      // same 3-day window so today's products show up without nuking the
      // API budget. Longer history is covered by /api/admin/backfill.
      track('products',   () => syncProducts(tightRange)),
    ]);
    try { await buildRollups(); } catch (e) { console.error('[sync-now] rollup failed:', e); }
  })();

  return Response.json({ ok: true, started: new Date().toISOString() });
}
