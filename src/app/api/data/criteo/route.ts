import { parseFilters, getCached, jsonResponse, errorResponse } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { period, compare } = parseFilters(req);
  const payload = await getCached('criteo', period, compare);
  if (!payload) return errorResponse('No cache', 503);
  return jsonResponse({ period, compare, platform: 'criteo', payload });
}
