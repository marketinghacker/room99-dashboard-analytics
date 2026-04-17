import { parseFilters, getCached, jsonResponse, errorResponse } from '@/lib/api';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { period, compare } = parseFilters(req);
  const payload = await getCached('pinterest', period, compare);
  if (!payload) return errorResponse('No cache', 503);

  const freshRes: any = await db.execute(
    sql`SELECT MAX(date)::text AS last FROM ad_performance_daily WHERE datasource='pinterest'`,
  );
  const windsorLastDay = freshRes.rows?.[0]?.last ?? (freshRes as any)[0]?.last ?? null;

  return jsonResponse({ period, compare, platform: 'pinterest', payload, windsorLastDay });
}
