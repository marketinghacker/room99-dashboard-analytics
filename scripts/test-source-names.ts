/**
 * Test various filter_order_source values against get_daily_revenue to find
 * what actually filters for user's "Allegro" = Room99_Official and the Shoper.
 */
import { connectMCP, callMCPTool } from '../src/lib/sync/mcp-client.ts';

const c = await connectMCP('https://mcp-sellrocket.up.railway.app/mcp', 'sse');

const TEST_DAY = '2026-04-15';
const filters = [
  undefined,            // no filter (total)
  'SHR',                // category
  'ALL',                // Allegro category
  'Room99_Official',    // specific source name
  'Room99.pl',          // Shoper source name
  'Shoper',             // human-readable
  'e_homeconcept',
  'allegro',            // lowercase
  'Allegro',            // capitalized
];

for (const f of filters) {
  try {
    const args: Record<string, any> = { date: TEST_DAY };
    if (f) args.filter_order_source = f;
    const r = await callMCPTool<any>(c, 'get_daily_revenue', args, { timeoutMs: 120_000 });
    console.log(`  filter=${(f ?? 'NONE').padEnd(20)} → ${r.order_count} orders, ${(r.revenue ?? 0).toFixed(2)} zł`);
  } catch (e) {
    console.log(`  filter=${(f ?? 'NONE').padEnd(20)} → ERROR: ${(e as Error).message}`);
  }
}

await c.close();
