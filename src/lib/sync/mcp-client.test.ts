import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractJSONFromMCPText, callMCPTool, type CallMCPOptions } from './mcp-client';

describe('extractJSONFromMCPText', () => {
  it('parses pure JSON object', () => {
    expect(extractJSONFromMCPText('{"rows":[1,2]}')).toEqual({ rows: [1, 2] });
  });

  it('parses pure JSON array', () => {
    expect(extractJSONFromMCPText('[{"id":1}]')).toEqual([{ id: 1 }]);
  });

  it('strips leading prose before JSON object', () => {
    expect(extractJSONFromMCPText('Fetched 5 rows. {"rows":[1,2]}')).toEqual({ rows: [1, 2] });
  });

  it('strips leading prose before JSON array', () => {
    expect(extractJSONFromMCPText('Results:\n[{"id":1}]')).toEqual([{ id: 1 }]);
  });

  it('throws if no JSON delimiters found', () => {
    expect(() => extractJSONFromMCPText('just some text')).toThrow(/No JSON/);
  });

  it('throws on malformed JSON', () => {
    expect(() => extractJSONFromMCPText('{"rows":[1,')).toThrow();
  });
});

describe('callMCPTool (with injected client)', () => {
  it('returns parsed JSON from text content', async () => {
    const fakeClient = {
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"rows":[{"id":1}]}' }],
      }),
    };
    const out = await callMCPTool(fakeClient as any, 'list_stuff', { limit: 10 });
    expect(out).toEqual({ rows: [{ id: 1 }] });
    expect(fakeClient.callTool).toHaveBeenCalledWith(
      { name: 'list_stuff', arguments: { limit: 10 } },
      undefined,
      undefined,
    );
  });

  it('throws if response has isError=true', async () => {
    const fakeClient = {
      callTool: vi.fn().mockResolvedValue({
        isError: true,
        content: [{ type: 'text', text: 'tool failed: bad arg' }],
      }),
    };
    await expect(callMCPTool(fakeClient as any, 'x', {})).rejects.toThrow(/tool failed/);
  });

  it('retries on transient failure up to N times', async () => {
    const callTool = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue({ content: [{ type: 'text', text: '{"ok":true}' }] });

    const fakeClient = { callTool };
    const opts: CallMCPOptions = { retries: 3, initialBackoffMs: 1 };
    const out = await callMCPTool(fakeClient as any, 'x', {}, opts);

    expect(out).toEqual({ ok: true });
    expect(callTool).toHaveBeenCalledTimes(3);
  });

  it('gives up after all retries exhausted', async () => {
    const callTool = vi.fn().mockRejectedValue(new Error('permanent fail'));
    const fakeClient = { callTool };
    await expect(
      callMCPTool(fakeClient as any, 'x', {}, { retries: 2, initialBackoffMs: 1 })
    ).rejects.toThrow(/permanent fail/);
    expect(callTool).toHaveBeenCalledTimes(2);
  });
});
