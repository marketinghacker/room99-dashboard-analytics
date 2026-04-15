import { type NextRequest } from 'next/server';
import { cacheGet, cacheSet, buildCacheKey, cacheLastUpdated } from '@/lib/cache';
import fs from 'fs';
import path from 'path';

/**
 * BaseLinker route — static JSON fallback only.
 * MCP connector for BaseLinker requires account config that is not available.
 * Once MCP is working, this can be switched to live calls like the other routes.
 */

const LIVE_DATA_PATH = path.join(process.cwd(), 'data', 'live-baselinker.json');
const EMPTY_DATA = {
  revenue: 0,
  orderCount: 0,
  aov: 0,
  products: [],
  categoryAggregates: [],
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || '';
  const end = searchParams.get('end') || '';
  const refresh = searchParams.get('refresh') === 'true';

  const cacheKey = buildCacheKey('baselinker', { start, end });

  if (!refresh) {
    const cached = cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      return Response.json({
        data: cached,
        lastUpdated: cacheLastUpdated(cacheKey),
        cached: true,
      });
    }
  }

  try {
    let data = EMPTY_DATA as Record<string, unknown>;

    if (fs.existsSync(LIVE_DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(LIVE_DATA_PATH, 'utf-8'));
    }

    cacheSet(cacheKey, data);

    return Response.json({
      data,
      lastUpdated: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'BaseLinker data read failed' },
      { status: 500 },
    );
  }
}
