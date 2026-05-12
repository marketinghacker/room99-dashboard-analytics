/**
 * POST /api/admin/refresh
 *
 * Manual force-refresh per source(s) over an arbitrary date range. UI-driven
 * (RefreshDataModal in Topbar) and SYNCHRONOUS — the user is staring at a
 * spinner, so we wait for completion and return per-source results.
 *
 * Mirrors the orchestration of /api/cron/sync but:
 *   - Auth is JWT cookie (agency role) instead of CRON_SECRET. The proxy
 *     marks /api/admin/* public for cron use, so we re-check the cookie
 *     ourselves via requireRole().
 *   - Date range is caller-provided (not a fixed lookback).
 *   - Sources are caller-provided (not all of them).
 *   - Sources run SEQUENTIALLY to avoid hammering rate-limited MCP servers
 *     when the user fires multiple back-to-back refreshes.
 *
 * Body:
 *   {
 *     sources: ('meta' | 'google_ads' | 'criteo' | 'ga4' | 'pinterest' |
 *               'sellrocket' | 'products' | 'all')[];
 *     start: 'YYYY-MM-DD';
 *     end: 'YYYY-MM-DD';   // inclusive, must be >= start
 *     rebuildRollups: boolean;  // call buildRollups() after sync (synchronously)
 *   }
 *
 * Response (always 200 once auth + payload validate; per-source failures are
 * reported in `sources[]` rather than failing the whole request):
 *   {
 *     ok: boolean;             // true iff every source status === 'success'
 *     sources: Array<{
 *       source: string;
 *       status: 'success' | 'failed';
 *       rowsWritten?: number;
 *       error?: string;
 *       ms: number;
 *     }>;
 *     rollup: { rebuilt: boolean; ms?: number };
 *     totalMs: number;
 *   }
 */
import { syncMetaGraph } from '@/lib/sync/meta-graph';
import { syncGoogleAds } from '@/lib/sync/google-ads';
import { syncCriteo } from '@/lib/sync/criteo';
import { syncGA4 } from '@/lib/sync/ga4';
import { syncPinterest } from '@/lib/sync/pinterest';
import { syncSellRocket } from '@/lib/sync/sellrocket';
import { syncSellRocketDirect } from '@/lib/sync/sellrocket-direct';
import { syncProducts } from '@/lib/sync/products';
import { startRun, finishRun, withTimeout } from '@/lib/sync/run-tracker';
import { buildRollups } from '@/lib/rollup';
import { requireRole } from '@/lib/auth';
import { type DateRange } from '@/lib/periods';

export const runtime = 'nodejs';
// User waits for completion. Bound by Railway's 5-min ingress; per-source
// caps below ensure no single source eats the budget.
export const maxDuration = 300;

type Source = 'meta' | 'google_ads' | 'criteo' | 'ga4' | 'pinterest' | 'sellrocket' | 'products';

const ALL_SOURCES: readonly Source[] = [
  'meta',
  'google_ads',
  'criteo',
  'ga4',
  'pinterest',
  'sellrocket',
  'products',
] as const;

const VALID_INPUT_SOURCES = new Set<string>([...ALL_SOURCES, 'all']);

// Same shape as the cron route — gives each source a hard ceiling so one
// hung MCP transport can't starve the others. SellRocket gets a higher cap
// because BaseLinker pagination is slow over wide ranges.
const SOURCE_TIMEOUT_MS: Record<Source, number> = {
  meta: 150_000,
  google_ads: 60_000,
  criteo: 120_000,
  ga4: 60_000,
  pinterest: 30_000,
  sellrocket: 120_000,
  products: 60_000,
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type SourceResult = {
  source: Source;
  status: 'success' | 'failed';
  rowsWritten?: number;
  error?: string;
  ms: number;
};

async function runOne(source: Source, range: DateRange): Promise<SourceResult> {
  const id = await startRun(source);
  const t0 = Date.now();
  try {
    const fn = pickSyncFn(source, range);
    const out = await withTimeout(fn(), SOURCE_TIMEOUT_MS[source], `refresh ${source}`);
    await finishRun(id, { status: 'success', rowsWritten: out.rowsWritten });
    return { source, status: 'success', rowsWritten: out.rowsWritten, ms: Date.now() - t0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishRun(id, { status: 'failed', error: msg });
    return { source, status: 'failed', error: msg, ms: Date.now() - t0 };
  }
}

function pickSyncFn(source: Source, range: DateRange): () => Promise<{ rowsWritten: number }> {
  switch (source) {
    case 'meta':       return () => syncMetaGraph(range);
    case 'google_ads': return () => syncGoogleAds(range);
    case 'criteo':     return () => syncCriteo(range);
    case 'ga4':        return () => syncGA4(range);
    case 'pinterest':  return () => syncPinterest(range);
    case 'sellrocket':
      // Prefer direct BaseLinker API when token is set (more accurate Allegro
      // late-confirm handling); fall back to MCP otherwise.
      return process.env.BASELINKER_API_TOKEN
        ? () => syncSellRocketDirect(range)
        : () => syncSellRocket(range);
    case 'products':   return () => syncProducts(range);
  }
}

type Body = {
  sources?: unknown;
  start?: unknown;
  end?: unknown;
  rebuildRollups?: unknown;
};

function parseBody(raw: Body): { sources: Source[]; range: DateRange; rebuildRollups: boolean } | string {
  if (!Array.isArray(raw.sources) || raw.sources.length === 0) {
    return 'sources: must be a non-empty array';
  }
  if (typeof raw.start !== 'string' || !ISO_DATE.test(raw.start)) {
    return 'start: must be YYYY-MM-DD';
  }
  if (typeof raw.end !== 'string' || !ISO_DATE.test(raw.end)) {
    return 'end: must be YYYY-MM-DD';
  }
  if (raw.start > raw.end) {
    return 'start must be <= end';
  }
  for (const s of raw.sources) {
    if (typeof s !== 'string' || !VALID_INPUT_SOURCES.has(s)) {
      return `unknown source: ${String(s)}`;
    }
  }
  // Resolve 'all' → full source list. Dedupe in case caller passed both.
  const expanded: Source[] = [];
  const seen = new Set<Source>();
  for (const s of raw.sources as string[]) {
    if (s === 'all') {
      for (const a of ALL_SOURCES) {
        if (!seen.has(a)) {
          seen.add(a);
          expanded.push(a);
        }
      }
    } else if (!seen.has(s as Source)) {
      seen.add(s as Source);
      expanded.push(s as Source);
    }
  }
  return {
    sources: expanded,
    range: { start: raw.start, end: raw.end },
    rebuildRollups: raw.rebuildRollups === undefined ? true : Boolean(raw.rebuildRollups),
  };
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireRole(req, 'agency');
  if (auth instanceof Response) return auth;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (typeof parsed === 'string') {
    return Response.json({ error: parsed }, { status: 400 });
  }
  const { sources, range, rebuildRollups } = parsed;

  const t0 = Date.now();
  const results: SourceResult[] = [];

  // Sequential: each source waits for the previous one to finish. This is
  // intentional — running 7 syncs in parallel hammered the MCP servers when
  // an agency user fired multiple Odśwież clicks back-to-back. Sequential
  // also means the per-source heartbeat updates one-by-one, which the UI
  // can poll to show progress.
  for (const source of sources) {
    const r = await runOne(source, range);
    results.push(r);
  }

  // Rollup runs synchronously (the caller is waiting for fresh data to
  // appear in the dashboard, and the rollup is what /api/data/* reads).
  let rollup: { rebuilt: boolean; ms?: number };
  if (rebuildRollups) {
    const r0 = Date.now();
    try {
      await buildRollups();
      rollup = { rebuilt: true, ms: Date.now() - r0 };
    } catch (err) {
      // Don't fail the whole response — the user got their fresh sync rows
      // even if the rollup blew up. Surface in the response so the UI can
      // suggest a retry.
      rollup = {
        rebuilt: false,
        ms: Date.now() - r0,
      };
      console.error('[refresh] rollup failed:', err);
    }
  } else {
    rollup = { rebuilt: false };
  }

  const ok = results.every((r) => r.status === 'success');

  return Response.json({
    ok,
    sources: results,
    rollup,
    totalMs: Date.now() - t0,
  });
}
