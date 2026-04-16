/**
 * Top-selling products from GA4 items report.
 * Queries GA4 live via MCP because items-level data isn't in the daily rollup.
 */
import { parseFilters, jsonResponse, errorResponse } from '@/lib/api';
import { resolvePeriod } from '@/lib/periods';
import { connectMCP, callMCPTool } from '@/lib/sync/mcp-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MCP_URL = process.env.MCP_GA4_URL || 'https://mcp-analytics.up.railway.app/mcp';
const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '315856757';

export async function GET(req: Request) {
  const { period, compare } = parseFilters(req);
  const range = resolvePeriod(period);

  const client = await connectMCP(MCP_URL, 'sse');
  try {
    const resp: any = await callMCPTool(
      client,
      'run_report',
      {
        property_id: PROPERTY_ID,
        start_date: range.start,
        end_date: range.end,
        dimensions: ['itemName', 'itemCategory'],
        metrics: ['itemsViewed', 'itemsAddedToCart', 'itemsPurchased', 'itemRevenue'],
        limit: 200,
        order_bys: [{ metric: { metric_name: 'itemRevenue' }, desc: true }],
      }
    );
    const raw: any[] = Array.isArray(resp) ? resp : resp.rows ?? resp.data ?? [];

    const items = raw.map((r) => {
      const d = r.dimensions ?? {};
      const m = r.metrics ?? {};
      const dimVals = r.dimensionValues?.map((x: any) => x.value) ?? [];
      const metVals = r.metricValues?.map((x: any) => x.value) ?? [];
      return {
        name: d.itemName ?? dimVals[0] ?? 'Unknown',
        category: d.itemCategory ?? dimVals[1] ?? '',
        viewed: Math.round(Number(m.itemsViewed ?? metVals[0] ?? 0)),
        addedToCart: Math.round(Number(m.itemsAddedToCart ?? metVals[1] ?? 0)),
        purchased: Math.round(Number(m.itemsPurchased ?? metVals[2] ?? 0)),
        revenue: Number(m.itemRevenue ?? metVals[3] ?? 0),
      };
    });

    return jsonResponse({ period, compare, range, items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse(msg, 502);
  } finally {
    await client.close();
  }
}
