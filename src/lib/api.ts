/**
 * API helpers used by every /api/data/* route.
 *
 * - `parseFilters` parses ?period=&compare= query params with sensible defaults
 * - `getCached` reads dashboard_cache for a (platform, period, compare) key
 */
import { db as defaultDb, type DB } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { dashboardCache } from '@/lib/schema';
import {
  PERIOD_KEYS,
  resolvePeriod,
  resolveCompare,
  type PeriodKey,
  type CompareKey,
} from '@/lib/periods';
import { type RollupPayload, type Platform } from '@/lib/rollup';

const ALL_COMPARES: readonly CompareKey[] = [
  'previous_period', 'same_period_last_year', 'same_period_last_quarter', 'none',
];

function isPresetPeriodKey(s: string): s is PeriodKey {
  return (PERIOD_KEYS as readonly string[]).includes(s)
    || /^custom_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/.test(s);
}

function isCompareKey(s: string): s is CompareKey {
  return (ALL_COMPARES as readonly string[]).includes(s);
}

export function parseFilters(req: Request): {
  period: PeriodKey;
  compare: CompareKey;
} {
  const url = new URL(req.url);
  const rawPeriod = url.searchParams.get('period') ?? 'last_30d';
  const rawCompare = url.searchParams.get('compare') ?? 'previous_period';
  const period: PeriodKey = isPresetPeriodKey(rawPeriod) ? rawPeriod : 'last_30d';
  const compare: CompareKey = isCompareKey(rawCompare) ? rawCompare : 'previous_period';
  return { period, compare };
}

export async function getCached(
  platform: Platform,
  period: PeriodKey,
  compare: CompareKey,
  db: DB = defaultDb
): Promise<RollupPayload | null> {
  // Custom ranges aren't pre-cached — compute on the fly.
  if (typeof period === 'string' && period.startsWith('custom_')) {
    const { buildOneLive } = await import('@/lib/rollup');
    const range = resolvePeriod(period);
    const compareRange = resolveCompare(range, compare);
    return buildOneLive(db, platform, range, compareRange);
  }

  const rows = await db
    .select({ payload: dashboardCache.payload })
    .from(dashboardCache)
    .where(
      and(
        eq(dashboardCache.periodKey, period),
        eq(dashboardCache.platform, platform),
        eq(dashboardCache.compareKey, compare),
      ),
    )
    .limit(1);
  const cached = rows[0]?.payload as RollupPayload | undefined;
  if (cached) return cached;

  // Cache miss for a preset combo — build live so UI never 503s. The cron
  // rebuilds the common combos hourly; this path covers newly-selected
  // (period, compare) pairs the user picks from the UI before cron catches up.
  const { buildOneLive } = await import('@/lib/rollup');
  const range = resolvePeriod(period);
  const compareRange = resolveCompare(range, compare);
  return buildOneLive(db, platform, range, compareRange);
}

export function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, {
    headers: {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
    },
    ...init,
  });
}

export function errorResponse(message: string, status = 500): Response {
  return Response.json({ error: message }, { status });
}
