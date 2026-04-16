import { parseFilters, getCached, jsonResponse, errorResponse } from '@/lib/api';
import { type Platform } from '@/lib/rollup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAID: Platform[] = ['meta', 'google_ads', 'criteo', 'pinterest'];

export async function GET(req: Request) {
  const { period, compare } = parseFilters(req);
  const all = await getCached('all', period, compare);
  if (!all) return errorResponse('No cache', 503);
  const perPlatform = await Promise.all(
    PAID.map(async (p) => ({ platform: p, payload: await getCached(p, period, compare) }))
  );
  return jsonResponse({ period, compare, all, perPlatform });
}
