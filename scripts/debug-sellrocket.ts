import { Agent, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(new Agent({ headersTimeout: 600_000, bodyTimeout: 600_000 }));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const url = 'https://mcp-sellrocket.up.railway.app/mcp';
const transport = new SSEClientTransport(new URL(url));
const client = new Client({ name: 'debug', version: '1' });
await client.connect(transport);
console.log('connected');

const dates = ['2026-04-15', '2026-04-14', '2026-04-13', '2026-04-12', '2026-04-11'];
for (const date of dates) {
  const t0 = Date.now();
  try {
    const r: any = await client.callTool(
      { name: 'get_daily_revenue', arguments: { date, filter_order_source: 'SHR' } },
      undefined,
      { timeout: 300_000 },
    );
    const text = r.content[0].text;
    const data = JSON.parse(text.slice(text.search(/[{[]/)));
    console.log(`${date} SHR: orders=${data.order_count} rev=${data.revenue} (${Date.now() - t0}ms)`);
  } catch (e) {
    console.log(`${date} FAIL (${Date.now() - t0}ms): ${(e as Error).message}`);
  }
}

await client.close();
