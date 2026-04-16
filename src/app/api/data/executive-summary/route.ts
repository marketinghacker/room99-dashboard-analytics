/**
 * GET /api/data/executive-summary?period=...&compare=...
 * Returns cross-platform rollup + per-platform summaries.
 */
import { parseFilters, getCached, jsonResponse, errorResponse } from '@/lib/api';
import { type Platform } from '@/lib/rollup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLATFORMS: Platform[] = ['meta', 'google_ads', 'criteo', 'pinterest', 'ga4'];

export async function GET(req: Request) {
  const { period, compare } = parseFilters(req);

  const all = await getCached('all', period, compare);
  if (!all) return errorResponse('No rollup cached — trigger /api/cron/sync', 503);

  const perPlatform = await Promise.all(
    PLATFORMS.map(async (p) => ({ platform: p, payload: await getCached(p, period, compare) }))
  );

  return jsonResponse({
    period,
    compare,
    all,
    perPlatform,
  });
}
