import { connectMCP, callMCPTool } from '../src/lib/sync/mcp-client.ts';

const client = await connectMCP('https://mcp-meta.up.railway.app/mcp', 'sse');

console.log('\n--- Attempt: time_range + time_increment ---');
try {
  const resp: any = await callMCPTool(client, 'get_insights', {
    account_id: 'act_295812916',
    level: 'campaign',
    time_range: { since: '2026-04-09', until: '2026-04-15' },
    time_increment: 1,
    fields: ['campaign_id', 'campaign_name', 'spend', 'impressions', 'clicks', 'date_start', 'date_stop'],
    limit: 5000,
  });
  const rows = Array.isArray(resp) ? resp : resp.data ?? resp.insights ?? [];
  const dates = new Set(rows.map((r: any) => r.date_start));
  console.log(`Rows: ${rows.length}, unique dates: ${dates.size}`);
  if (rows[0]) console.log('First:', rows[0]);
} catch (e) {
  console.log('Failed:', (e as Error).message);
}

await client.close();
