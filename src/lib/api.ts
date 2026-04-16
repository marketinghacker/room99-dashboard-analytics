/**
 * API helpers used by every /api/data/* route.
 *
 * - `parseFilters` parses ?period=&compare= query params with sensible defaults
 * - `getCached` reads dashboard_cache for a (platform, period, compare) key
 */
import { db as defaultDb, type DB } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { dashboardCache } from '@/lib/schema';
import { PERIOD_KEYS, type PeriodKey, type CompareKey } from '@/lib/periods';
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
  return (rows[0]?.payload as RollupPayload | undefined) ?? null;
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
