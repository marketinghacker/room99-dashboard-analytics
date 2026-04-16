/**
 * Diagnostic: why does `filter_order_source='SHR'` return more orders than
 * the unfiltered query on some days? Tests with explicit status + parameters.
 */
import { Agent, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(new Agent({ headersTimeout: 600_000, bodyTimeout: 600_000 }));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const transport = new SSEClientTransport(new URL('https://mcp-sellrocket.up.railway.app/mcp'));
const client = new Client({ name: 'debug', version: '1' });
await client.connect(transport);

async function daily(date: string, filter?: string, extras: Record<string, any> = {}) {
  const args: Record<string, any> = { date, ...extras };
  if (filter) args.filter_order_source = filter;
  const t0 = Date.now();
  const r: any = await client.callTool({ name: 'get_daily_revenue', arguments: args }, undefined, { timeout: 300_000 });
  const text = r.content[0].text;
  const data = JSON.parse(text.slice(text.search(/[{[]/)));
  const ms = Date.now() - t0;
  console.log(`  ${date} filter=${filter ?? 'NONE'} extras=${JSON.stringify(extras)} → orders=${data.order_count} rev=${data.revenue.toFixed(2)} (${ms}ms)`);
  return data;
}

const date = '2026-04-13';

// 1) get_order_sources — see full structure
const srcs: any = await client.callTool({ name: 'get_order_sources', arguments: {} }, undefined, { timeout: 60_000 });
const srcText = srcs.content[0].text;
const srcData = JSON.parse(srcText.slice(srcText.search(/[{[]/)));
console.log('sources top-level keys:', Object.keys(srcData));
const inner = srcData.sources ?? srcData;
for (const [category, items] of Object.entries(inner)) {
  console.log(`\n${category}:`);
  console.log(JSON.stringify(items, null, 2));
}

// 2) filter_order_source_id — try numeric
console.log(`\n=== ${date} — try filter_order_source_id ===`);
await daily(date, undefined, { filter_order_source_id: 9 });   // Room99.pl direct
await daily(date, 'SHR');                                       // By group name
await daily(date, 'allegro');                                   // lowercase

await client.close();
