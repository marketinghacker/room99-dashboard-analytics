/**
 * Lists every BaseLinker order source id for Room99 (so we know exactly which
 * sub-accounts to hit when filtering Allegro).
 *
 * Usage: node --env-file=.env.local --import=tsx scripts/list-allegro-sources.ts
 */
import { connectMCP } from '../src/lib/sync/mcp-client.ts';

const c = await connectMCP('https://mcp-sellrocket.up.railway.app/mcp', 'sse');
const res: any = await c.callTool(
  { name: 'get_order_sources', arguments: {} },
  undefined,
  { timeout: 180_000 },
);
const text = res.content[0].text;
const data = JSON.parse(text.slice(text.search(/[{[]/)));
const inner = data.sources ?? data;

console.log('BaseLinker order source codes (for Room99):');
for (const [category, subs] of Object.entries(inner)) {
  console.log(`\n${category}:`);
  for (const [id, name] of Object.entries(subs as Record<string, string>)) {
    console.log(`  id=${id.padEnd(10)} name=${name || '(blank)'}`);
  }
}

await c.close();
