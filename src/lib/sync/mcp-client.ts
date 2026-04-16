/**
 * MCP client wrapper using the official @modelcontextprotocol/sdk.
 * Handles both SSE and streamable-HTTP transports, retries, and JSON extraction
 * from the text-content envelope many MCP servers return.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Agent, setGlobalDispatcher } from 'undici';

// Node's default undici Agent has a 60s headersTimeout that kills SSE
// connections when BaseLinker/MCP takes a long time to stream next event.
// Bump both timeouts to 10 minutes for data-heavy MCPs. Applied at module load.
setGlobalDispatcher(
  new Agent({
    headersTimeout: 600_000,
    bodyTimeout: 600_000,
    keepAliveTimeout: 600_000,
    connectTimeout: 30_000,
  }),
);

export type MCPTransport = 'sse' | 'http';

export type CallMCPOptions = {
  retries?: number;
  initialBackoffMs?: number;
  /** Per-call timeout in ms. SDK default is 60_000; some tools (BaseLinker
   *  pagination) need longer. */
  timeoutMs?: number;
};

export type MCPCaller = {
  callTool: (...args: any[]) => Promise<any>;
};

/**
 * Many MCP servers wrap tool output in a text envelope like
 * "Fetched N rows. {...}" or prepend a summary sentence before the JSON.
 * This util locates the first [ or { and parses from there.
 */
export function extractJSONFromMCPText(text: string): unknown {
  const first = text.search(/[[{]/);
  if (first === -1) throw new Error(`No JSON delimiters in MCP text: ${text.slice(0, 120)}`);
  const slice = text.slice(first);
  try {
    return JSON.parse(slice);
  } catch (err) {
    throw new Error(`Failed to parse MCP JSON: ${(err as Error).message} — text: ${slice.slice(0, 200)}`);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Invoke a tool on an already-connected MCP client, with retries + JSON parsing.
 * Returns the parsed payload (or the raw response if no text content).
 */
export async function callMCPTool<T = unknown>(
  client: MCPCaller,
  tool: string,
  args: Record<string, unknown>,
  opts: CallMCPOptions = {}
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseBackoff = opts.initialBackoffMs ?? 500;

  const requestOpts = opts.timeoutMs ? { timeout: opts.timeoutMs } : undefined;

  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await client.callTool(
        { name: tool, arguments: args },
        undefined,
        requestOpts,
      );
      if (res.isError) {
        const errText = res.content?.[0]?.text ?? 'unknown MCP error';
        throw new Error(`MCP tool ${tool} failed: ${errText}`);
      }
      const text = res.content?.[0]?.text;
      if (typeof text !== 'string') return res as T;
      return extractJSONFromMCPText(text) as T;
    } catch (err) {
      lastError = err;
      const isLast = attempt === retries - 1;
      if (isLast) throw err;
      await sleep(baseBackoff * 2 ** attempt);
    }
  }
  throw lastError ?? new Error('MCP call failed');
}

/**
 * Connect to an MCP server + return the raw SDK client.
 * Caller must `await client.close()` when done.
 */
export async function connectMCP(url: string, transport: MCPTransport = 'sse'): Promise<Client> {
  const u = new URL(url);
  const t = transport === 'http'
    ? new StreamableHTTPClientTransport(u)
    : new SSEClientTransport(u);
  const client = new Client({ name: 'room99-dashboard', version: '3.0.0' });
  await client.connect(t);
  return client;
}
