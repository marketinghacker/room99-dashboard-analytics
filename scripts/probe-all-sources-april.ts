/**
 * For 2026-04-01..2026-04-16, probe revenue per source (by numeric id) to
 * find where Marcin's reference Allegro total (916,030 zł) is hiding.
 */
import { connectMCP } from '../src/lib/sync/mcp-client.ts';

const c = await connectMCP('https://mcp-sellrocket.up.railway.app/mcp', 'sse');

const sourcesCall: any = await c.callTool(
  { name: 'get_order_sources', arguments: {} },
  undefined,
  { timeout: 120_000 },
);
const srcText = sourcesCall.content[0].text;
const sourcesByCategory = JSON.parse(srcText.slice(srcText.search(/[{[]/))).sources;

// Flatten → [{id, name, category}]
const allSources: Array<{ id: number; name: string; category: string }> = [];
for (const [cat, subs] of Object.entries(sourcesByCategory)) {
  for (const [id, name] of Object.entries(subs as Record<string, string>)) {
    allSources.push({ id: Number(id), name: String(name), category: cat });
  }
}

// Sample only 2 busy days to avoid 60+ min probe
const dates = ['2026-04-14', '2026-04-15'];
console.log(`Probing ${allSources.length} sources × ${dates.length} days ≈ ${allSources.length * dates.length * 15 / 60 | 0} min`);

const totals: Record<string, { orders: number; revenue: number; category: string; name: string }> = {};

for (const s of allSources) {
  let orders = 0, revenue = 0;
  for (const date of dates) {
    try {
      const r: any = await c.callTool(
        { name: 'get_daily_revenue', arguments: { date, filter_order_source_id: s.id } },
        undefined,
        { timeout: 180_000 },
      );
      const txt = r.content[0].text;
      const data = JSON.parse(txt.slice(txt.search(/[{[]/)));
      orders += data.order_count ?? 0;
      revenue += data.revenue ?? 0;
    } catch (err) {
      console.warn(`  ${s.category}/${s.id} ${date} failed: ${(err as Error).message}`);
    }
  }
  totals[`${s.category}:${s.id}:${s.name}`] = { orders, revenue, category: s.category, name: s.name };
  console.log(`  ${s.category.padEnd(20)} id=${String(s.id).padEnd(10)} ${s.name.padEnd(25)} → ${orders} orders, ${revenue.toFixed(2)} zł`);
}

console.log('\n=== AGGREGATE by category ===');
const byCat: Record<string, { orders: number; revenue: number }> = {};
for (const t of Object.values(totals)) {
  byCat[t.category] = byCat[t.category] ?? { orders: 0, revenue: 0 };
  byCat[t.category].orders += t.orders;
  byCat[t.category].revenue += t.revenue;
}
for (const [cat, v] of Object.entries(byCat)) {
  console.log(`  ${cat.padEnd(20)} ${v.orders} orders, ${v.revenue.toFixed(2)} zł`);
}

await c.close();
