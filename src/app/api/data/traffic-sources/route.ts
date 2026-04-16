/**
 * GA4 traffic by channelGroup + top sources.
 */
import { parseFilters, getCached, jsonResponse, errorResponse } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { period, compare } = parseFilters(req);
  const payload = await getCached('ga4', period, compare);
  if (!payload) return errorResponse('No cache', 503);
  return jsonResponse({
    period,
    compare,
    kpis: payload.kpis,
    compareKpis: payload.compareKpis,
    channels: payload.channelBreakdown,
    timeSeries: payload.timeSeries,
  });
}
