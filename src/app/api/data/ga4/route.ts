import { type NextRequest } from 'next/server';
import { callMcpTool } from '@/lib/mcp-client';
import { cacheGet, cacheSet, buildCacheKey, cacheLastUpdated } from '@/lib/cache';

const GA4_PROPERTY_ID = '315856757';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || '';
  const end = searchParams.get('end') || '';
  const refresh = searchParams.get('refresh') === 'true';

  const cacheKey = buildCacheKey('ga4', { start, end });

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
    const [sessionsResult, trafficResult] = await Promise.allSettled([
      callMcpTool(
        'ga4',
        `Call the run_report tool with these exact parameters:
- property_id: "${GA4_PROPERTY_ID}"
- start_date: "${start || '30daysAgo'}"
- end_date: "${end || 'yesterday'}"
- metrics: ["sessions", "totalUsers", "newUsers", "engagementRate", "screenPageViews"]
- dimensions: ["date"]
Return ONLY the raw tool output as JSON.`,
      ),
      callMcpTool(
        'ga4',
        `Call the get_traffic_sources tool with these exact parameters:
- property_id: "${GA4_PROPERTY_ID}"
- start_date: "${start || '30daysAgo'}"
- end_date: "${end || 'yesterday'}"
- dimensions: ["sessionDefaultChannelGroup"]
Return ONLY the raw tool output as JSON.`,
      ),
    ]);

    const sessionsRaw =
      sessionsResult.status === 'fulfilled' ? sessionsResult.value : null;
    const trafficRaw =
      trafficResult.status === 'fulfilled' ? trafficResult.value : null;

    // Debug: log raw MCP response shape
    console.log('[GA4] sessionsRaw type:', typeof sessionsRaw, 'isString:', typeof sessionsRaw === 'string');
    if (sessionsRaw && typeof sessionsRaw === 'object') {
      const raw = sessionsRaw as Record<string, unknown>;
      console.log('[GA4] sessionsRaw keys:', Object.keys(raw));
      console.log('[GA4] rows is array:', Array.isArray(raw.rows), 'length:', (raw.rows as unknown[])?.length);
      if (Array.isArray(raw.rows) && (raw.rows as unknown[]).length > 0) {
        console.log('[GA4] row[0]:', JSON.stringify((raw.rows as unknown[])[0]).substring(0, 200));
      }
    }
    if (sessionsResult.status === 'rejected') {
      console.log('[GA4] sessions REJECTED:', sessionsResult.reason);
    }

    // Parse GA4 response — handles both flat and nested (dimensionValues/metricValues) formats
    function parseGA4Row(row: Record<string, unknown>, metricNames: string[], dimNames: string[]): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      // Nested format: { dimensionValues: [{value}], metricValues: [{value}] }
      const dims = row.dimensionValues as Array<{value: string}> | undefined;
      const mets = row.metricValues as Array<{value: string}> | undefined;
      if (dims && mets) {
        dimNames.forEach((name, i) => { if (dims[i]) result[name] = dims[i].value; });
        metricNames.forEach((name, i) => { if (mets[i]) result[name] = Number(mets[i].value); });
      } else {
        // Flat format
        for (const [k, v] of Object.entries(row)) result[k] = v;
      }
      return result;
    }

    let sessions: { rows: Record<string, unknown>[] } = { rows: [] };
    if (sessionsRaw && typeof sessionsRaw === 'object') {
      const raw = sessionsRaw as Record<string, unknown>;
      const rows = raw.rows as Record<string, unknown>[] | undefined;
      if (Array.isArray(rows)) {
        sessions = {
          rows: rows.map((r) => {
            const p = parseGA4Row(r, ['sessions', 'totalUsers', 'newUsers', 'engagementRate', 'screenPageViews'], ['date']);
            return {
              date: String(p.date || ''),
              sessions: Number(p.sessions || 0),
              totalUsers: Number(p.totalUsers || 0),
              newUsers: Number(p.newUsers || 0),
              engagementRate: Number(p.engagementRate || 0),
              screenPageViews: Number(p.screenPageViews || 0),
            };
          }),
        };
      }
    }

    let traffic: Record<string, unknown>[] = [];
    if (trafficRaw && typeof trafficRaw === 'object') {
      const raw = trafficRaw as Record<string, unknown>;
      const rows = raw.rows as Record<string, unknown>[] | undefined;
      if (Array.isArray(rows)) {
        traffic = rows.map((r) => {
          const p = parseGA4Row(r, ['sessions', 'totalUsers'], ['sessionDefaultChannelGroup']);
          return {
            channel: String(p.sessionDefaultChannelGroup || 'Unknown'),
            sessions: Number(p.sessions || 0),
            totalUsers: Number(p.totalUsers || 0),
          };
        });
      }
    }

    const data = {
      sessions,
      traffic,
      ecommerce: null,
      funnel: null,
    };

    cacheSet(cacheKey, data);

    return Response.json({
      data,
      lastUpdated: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error('GA4 MCP error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'GA4 data fetch failed' },
      { status: 500 },
    );
  }
}
