/**
 * Probe MCP server: list tools OR inspect one tool's schema.
 * Usage:
 *   node --env-file=.env.local --experimental-strip-types scripts/probe-mcp.ts <url>            # list all tools
 *   node --env-file=.env.local --experimental-strip-types scripts/probe-mcp.ts <url> <toolName> # show schema for one tool
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = process.argv[2] ?? 'https://mcp-meta.up.railway.app/mcp';
const toolFilter = process.argv[3];
const transportKind = process.env.MCP_TRANSPORT ?? 'sse';
console.log(`Connecting to ${url} (transport: ${transportKind})...`);

const transport = transportKind === 'http'
  ? new StreamableHTTPClientTransport(new URL(url))
  : new SSEClientTransport(new URL(url));
const client = new Client({ name: 'room99-probe', version: '1.0.0' });

await client.connect(transport);
console.log('✓ Connected\n');

const tools = await client.listTools();

if (toolFilter) {
  const match = tools.tools.find(t => t.name === toolFilter);
  if (!match) {
    console.log(`Tool "${toolFilter}" not found`);
    const near = tools.tools.filter(t => t.name.includes(toolFilter));
    if (near.length) console.log(`Did you mean: ${near.map(t => t.name).join(', ')}?`);
  } else {
    console.log(`Name: ${match.name}`);
    console.log(`Description: ${match.description}`);
    console.log('Input schema:');
    console.log(JSON.stringify(match.inputSchema, null, 2));
  }
} else {
  console.log(`${tools.tools.length} tools:`);
  for (const t of tools.tools) {
    console.log(`  • ${t.name}`);
  }
}

await client.close();
