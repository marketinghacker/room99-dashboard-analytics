import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const transport = new StreamableHTTPClientTransport(
  new URL('https://google-ads-mcp-server-production-7a5f.up.railway.app/mcp')
);
const client = new Client({ name: 'debug', version: '1' });
await client.connect(transport);

// Test run_query directly
console.log('Test 1: customer_id=1331139339');
const res: any = await client.callTool({
  name: 'google_ads_run_query',
  arguments: {
    customer_id: '1331139339',
    query: 'SELECT campaign.id, campaign.name FROM campaign LIMIT 3',
  },
});
console.log(JSON.stringify(res, null, 2).slice(0, 800));

await client.close();
