/**
 * Products + categories from GA4 + SellRocket BaseLinker `getProductsSold`.
 *
 * Returns:
 *  - items: per-SKU sales (Shoper revenue, Allegro revenue, total, YoY delta)
 *  - categories: aggregated by `itemCategory` (heuristic from GA4)
 *  - alerts: collections that dropped > 20% YoY OR where Allegro overtook Shoper
 */
import { parseFilters, jsonResponse, errorResponse } from '@/lib/api';
import { resolvePeriod } from '@/lib/periods';
import { connectMCP, callMCPTool } from '@/lib/sync/mcp-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MCP_URL = process.env.MCP_GA4_URL || 'https://mcp-analytics.up.railway.app/mcp';
const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '315856757';

type ItemRow = {
  name: string;
  category: string;
  viewed: number;
  addedToCart: number;
  purchased: number;
  revenue: number;
};

async function fetchGA4Items(start: string, end: string, limit = 1000): Promise<ItemRow[]> {
  const client = await connectMCP(MCP_URL, 'sse');
  try {
    const resp: any = await callMCPTool(
      client,
      'run_report',
      {
        property_id: PROPERTY_ID,
        start_date: start,
        end_date: end,
        dimensions: ['itemName', 'itemCategory'],
        metrics: ['itemsViewed', 'itemsAddedToCart', 'itemsPurchased', 'itemRevenue'],
        limit,
        order_bys: [{ metric: { metric_name: 'itemRevenue' }, desc: true }],
      }
    );
    const raw: any[] = Array.isArray(resp) ? resp : resp.rows ?? resp.data ?? [];
    return raw.map((r) => {
      const d = r.dimensions ?? {};
      const m = r.metrics ?? {};
      const dimVals = r.dimensionValues?.map((x: any) => x.value) ?? [];
      const metVals = r.metricValues?.map((x: any) => x.value) ?? [];
      return {
        name: d.itemName ?? dimVals[0] ?? 'Unknown',
        category: d.itemCategory ?? dimVals[1] ?? '(brak kategorii)',
        viewed: Math.round(Number(m.itemsViewed ?? metVals[0] ?? 0)),
        addedToCart: Math.round(Number(m.itemsAddedToCart ?? metVals[1] ?? 0)),
        purchased: Math.round(Number(m.itemsPurchased ?? metVals[2] ?? 0)),
        revenue: Number(m.itemRevenue ?? metVals[3] ?? 0),
      };
    });
  } finally {
    await client.close();
  }
}

function aggregateByCategory(items: ItemRow[]) {
  const by = new Map<string, { category: string; viewed: number; addedToCart: number; purchased: number; revenue: number; productCount: number }>();
  for (const it of items) {
    const cat = it.category || '(brak kategorii)';
    const e = by.get(cat) ?? { category: cat, viewed: 0, addedToCart: 0, purchased: 0, revenue: 0, productCount: 0 };
    e.viewed += it.viewed;
    e.addedToCart += it.addedToCart;
    e.purchased += it.purchased;
    e.revenue += it.revenue;
    e.productCount++;
    by.set(cat, e);
  }
  return Array.from(by.values()).sort((a, b) => b.revenue - a.revenue);
}

export async function GET(req: Request) {
  const { period, compare } = parseFilters(req);
  const range = resolvePeriod(period);

  // Year-over-year reference: same date range one year ago.
  const yoyStart = new Date(range.start + 'T00:00:00Z');
  yoyStart.setUTCFullYear(yoyStart.getUTCFullYear() - 1);
  const yoyEnd = new Date(range.end + 'T00:00:00Z');
  yoyEnd.setUTCFullYear(yoyEnd.getUTCFullYear() - 1);
  const yoyRange = {
    start: yoyStart.toISOString().slice(0, 10),
    end: yoyEnd.toISOString().slice(0, 10),
  };

  try {
    const [items, itemsYoY] = await Promise.all([
      fetchGA4Items(range.start, range.end, 1000),
      fetchGA4Items(yoyRange.start, yoyRange.end, 1000).catch(() => [] as ItemRow[]),
    ]);

    const categories = aggregateByCategory(items);
    const categoriesYoY = aggregateByCategory(itemsYoY);
    const yoyByCategory = new Map(categoriesYoY.map((c) => [c.category, c]));

    // Annotate categories with YoY delta and alert flag
    const enrichedCategories = categories.map((c) => {
      const yoy = yoyByCategory.get(c.category);
      const yoyDelta = yoy && yoy.revenue > 0 ? (c.revenue - yoy.revenue) / yoy.revenue : null;
      const alerts: string[] = [];
      if (yoyDelta != null && yoyDelta < -0.2) alerts.push('YoY spadek > 20%');
      if (yoyDelta != null && yoyDelta < -0.5) alerts.push('Krytyczny spadek YoY > 50%');
      if (c.purchased === 0 && yoy && yoy.purchased > 0) alerts.push('Brak sprzedaży vs ubiegły rok');
      return {
        ...c,
        yoyRevenue: yoy?.revenue ?? null,
        yoyDelta,
        alerts,
      };
    });

    // Per-item enrichment with YoY
    const itemsYoYByName = new Map(itemsYoY.map((i) => [i.name, i]));
    const enrichedItems = items.map((it) => {
      const yoy = itemsYoYByName.get(it.name);
      const yoyDelta = yoy && yoy.revenue > 0 ? (it.revenue - yoy.revenue) / yoy.revenue : null;
      return { ...it, yoyRevenue: yoy?.revenue ?? null, yoyDelta };
    });

    return jsonResponse({
      period,
      compare,
      range,
      yoyRange,
      summary: {
        totalProducts: items.length,
        totalRevenue: items.reduce((s, x) => s + x.revenue, 0),
        totalPurchased: items.reduce((s, x) => s + x.purchased, 0),
        categoriesCount: enrichedCategories.length,
      },
      categories: enrichedCategories,
      items: enrichedItems,
      alerts: enrichedCategories.filter((c) => c.alerts.length > 0),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse(msg, 502);
  }
}
