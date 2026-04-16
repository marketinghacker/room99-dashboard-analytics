import { connectMCP } from '../src/lib/sync/mcp-client.ts';

const client = await connectMCP('https://mcp-criteo.up.railway.app/mcp', 'sse');

const args = {
  advertiser_ids: ['55483'],
  start_date: '2026-03-17',
  end_date: '2026-04-15',
  dimensions: ['Day', 'CampaignId', 'Campaign'],
  metrics: ['Clicks', 'Displays', 'AdvertiserCost', 'Ctr', 'Cpc', 'Cpm',
            'SalesAllPc30d', 'RevenueGeneratedPc30d', 'ConversionRate', 'RoasAllPc30d'],
  currency: 'PLN',
};
console.log('Args:', JSON.stringify(args));
const raw: any = await client.callTool({ name: 'get_campaign_stats', arguments: args });
const text = raw.content[0].text;
console.log('RAW (first 800):', text.slice(0, 800));

await client.close();
