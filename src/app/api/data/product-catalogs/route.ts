/**
 * Filters the 'all' rollup's campaign list to only catalog/shopping campaigns
 * (identified by campaign_objective heuristics: "Catalog", "Shopping", "Advantage+", etc.).
 */
import { parseFilters, getCached, jsonResponse, errorResponse } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATALOG_PATTERNS = /catalog|shopping|advantage|katalog|pmax|performance.?max/i;

export async function GET(req: Request) {
  const { period, compare } = parseFilters(req);
  const payload = await getCached('all', period, compare);
  if (!payload) return errorResponse('No cache', 503);
  const campaigns = payload.campaigns.filter(
    (c) => CATALOG_PATTERNS.test(c.name ?? '') || CATALOG_PATTERNS.test((c as any).campaignObjective ?? '')
  );
  return jsonResponse({
    period,
    compare,
    payload: { ...payload, campaigns },
  });
}
