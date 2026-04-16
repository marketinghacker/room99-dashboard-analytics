import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

/**
 * MCP Connector client for calling platform MCP servers via Claude Haiku.
 * Uses hardcoded system prompts — Haiku just routes tool calls, never invents queries.
 */

/** Read config from .dashboard-config.json (set via admin panel) */
function readDashboardConfig(): Record<string, string> {
  try {
    const configPath = path.join(process.cwd(), '.dashboard-config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

/** Get a config value — checks env vars first, then dashboard config file */
function getConfigValue(key: string): string {
  return process.env[key] || readDashboardConfig()[key] || '';
}

/** Lazy-init Anthropic client so it picks up keys set via admin panel after startup */
function getClient(): Anthropic {
  const key = getConfigValue('ANTHROPIC_API_KEY');
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY nie jest skonfigurowany. Wklej klucz API w panelu admina: /admin/settings');
  }
  return new Anthropic({ apiKey: key });
}

export interface McpServerConfig {
  name: string;
  url: string;
  token?: string;
}

/** Registry of all platform MCP servers */
const MCP_SERVERS: Record<string, () => McpServerConfig> = {
  ga4: () => ({
    name: 'ga4',
    url: getConfigValue('MCP_GA4_URL'),
    token: getConfigValue('MCP_GA4_TOKEN') || undefined,
  }),
  'google-ads': () => ({
    name: 'google-ads',
    url: getConfigValue('MCP_GOOGLE_ADS_URL'),
    token: getConfigValue('MCP_GOOGLE_ADS_TOKEN') || undefined,
  }),
  'meta-ads': () => ({
    name: 'meta-ads',
    url: getConfigValue('MCP_META_ADS_URL'),
    token: getConfigValue('MCP_META_ADS_TOKEN') || undefined,
  }),
  criteo: () => ({
    name: 'criteo',
    url: getConfigValue('MCP_CRITEO_URL'),
    token: getConfigValue('MCP_CRITEO_TOKEN') || undefined,
  }),
  baselinker: () => ({
    name: 'baselinker',
    url: getConfigValue('MCP_BASELINKER_URL'),
    token: getConfigValue('MCP_BASELINKER_TOKEN') || undefined,
  }),
};

export function getServerConfig(serverName: string): McpServerConfig {
  const factory = MCP_SERVERS[serverName];
  if (!factory) {
    throw new Error(`Unknown MCP server: ${serverName}`);
  }
  const config = factory();
  if (!config.url) {
    throw new Error(`MCP server URL not configured for: ${serverName}. Set MCP_${serverName.toUpperCase().replace('-', '_')}_URL env var.`);
  }
  return config;
}

/**
 * Try to parse JSON from text that may have a prefix (e.g. "Found 26 results.\n\n[...]")
 */
function parseJsonFromText(text: string): unknown {
  // Try direct parse first
  try { return JSON.parse(text); } catch { /* continue */ }

  // Try to find JSON array or object in the text
  const jsonStart = text.search(/[\[{]/);
  if (jsonStart >= 0) {
    const jsonStr = text.substring(jsonStart);
    try { return JSON.parse(jsonStr); } catch { /* continue */ }
  }

  return text; // Return as-is if no JSON found
}

/**
 * Extract tool result data from Claude's MCP response.
 * Looks for mcp_tool_result content blocks and returns the parsed text.
 */
function extractToolResult(response: Anthropic.Beta.Messages.BetaMessage): unknown {
  for (const block of response.content) {
    if (block.type === 'mcp_tool_result') {
      const resultBlock = block as unknown as {
        type: 'mcp_tool_result';
        content: Array<{ type: string; text?: string }>;
        is_error?: boolean;
      };

      if (resultBlock.is_error) {
        const errorText = resultBlock.content
          ?.filter((c) => c.type === 'text')
          .map((c) => c.text)
          .join('\n');
        throw new Error(`MCP tool error: ${errorText || 'Unknown error'}`);
      }

      const textContent = resultBlock.content
        ?.filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n');

      if (textContent) {
        return parseJsonFromText(textContent);
      }
    }

    // Also check for text blocks that Haiku might produce with the result
    if (block.type === 'text') {
      const text = (block as Anthropic.Beta.Messages.BetaTextBlock).text;
      const parsed = parseJsonFromText(text);
      if (parsed !== null && typeof parsed === 'object') {
        return parsed;
      }
    }
  }

  throw new Error('No tool result found in MCP response');
}

/**
 * Call an MCP tool via Claude Haiku.
 *
 * @param serverName - Key from MCP_SERVERS registry (e.g. 'ga4', 'google-ads')
 * @param systemPrompt - Hardcoded instruction telling Haiku exactly which tool to call
 * @param userMessage - Simple trigger message (e.g. "Execute.")
 * @returns The parsed tool result data
 */
export async function callMcpTool(
  serverName: string,
  systemPrompt: string,
  userMessage: string = 'Execute the tool call as instructed.'
): Promise<unknown> {
  const server = getServerConfig(serverName);

  const mcpServer: Record<string, unknown> = {
    type: 'url',
    url: server.url,
    name: server.name,
  };
  if (server.token) {
    mcpServer.authorization_token = server.token;
  }

  const response = await getClient().beta.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 4096,
    betas: ['mcp-client-2025-11-20'],
    mcp_servers: [mcpServer] as unknown as Anthropic.Beta.Messages.BetaRequestMCPServerURLDefinition[],
    tools: [
      {
        type: 'mcp_toolset' as unknown as 'computer_20241022',
        mcp_server_name: server.name,
        default_config: { enabled: true },
      } as unknown as Anthropic.Beta.Messages.BetaTool,
    ],
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  // If the model needs to make a tool call and returns end_turn with tool_use,
  // we already have the result since MCP Connector executes tools automatically
  return extractToolResult(response);
}

/**
 * Call multiple MCP tools on the same server in a single request.
 * The system prompt should instruct Haiku to call multiple tools.
 */
export async function callMcpToolMulti(
  serverName: string,
  systemPrompt: string,
  userMessage: string = 'Execute all tool calls as instructed.'
): Promise<unknown[]> {
  const server = getServerConfig(serverName);

  const mcpServer: Record<string, unknown> = {
    type: 'url',
    url: server.url,
    name: server.name,
  };
  if (server.token) {
    mcpServer.authorization_token = server.token;
  }

  const response = await getClient().beta.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 16384,
    betas: ['mcp-client-2025-11-20'],
    mcp_servers: [mcpServer] as unknown as Anthropic.Beta.Messages.BetaRequestMCPServerURLDefinition[],
    tools: [
      {
        type: 'mcp_toolset' as unknown as 'computer_20241022',
        mcp_server_name: server.name,
        default_config: { enabled: true },
      } as unknown as Anthropic.Beta.Messages.BetaTool,
    ],
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const results: unknown[] = [];
  for (const block of response.content) {
    if ((block as unknown as { type: string }).type === 'mcp_tool_result') {
      const resultBlock = block as unknown as {
        content: Array<{ type: string; text?: string }>;
        is_error?: boolean;
      };
      const text = resultBlock.content
        ?.filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n');
      if (text) {
        try {
          results.push(JSON.parse(text));
        } catch {
          results.push(text);
        }
      }
    }
  }

  return results;
}
