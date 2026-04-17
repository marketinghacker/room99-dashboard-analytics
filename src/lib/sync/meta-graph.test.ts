import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncMetaGraph, METRICS, extractPurchase } from './meta-graph';

const OLD_FETCH = global.fetch;
beforeEach(() => { global.fetch = vi.fn(); });
afterEach(() => { global.fetch = OLD_FETCH; });

describe('METRICS', () => {
  it('contains required Facebook fields', () => {
    expect(METRICS).toEqual(
      expect.arrayContaining(['campaign_id', 'campaign_name', 'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'actions', 'action_values', 'date_start', 'date_stop'])
    );
  });
});

describe('extractPurchase', () => {
  it('finds purchase action and value', () => {
    const row = {
      actions: [
        { action_type: 'link_click', value: '50' },
        { action_type: 'purchase', value: '10' },
      ],
      action_values: [
        { action_type: 'purchase', value: '1500.50' },
      ],
    } as any;
    expect(extractPurchase(row)).toEqual({ conversions: 10, conversionValue: 1500.5 });
  });
  it('handles omni_purchase + offsite_conversion aliases', () => {
    const row = {
      actions: [{ action_type: 'offsite_conversion.fb_pixel_purchase', value: '5' }],
      action_values: [{ action_type: 'offsite_conversion.fb_pixel_purchase', value: '750' }],
    } as any;
    expect(extractPurchase(row)).toEqual({ conversions: 5, conversionValue: 750 });
  });
  it('returns zero when no purchase actions', () => {
    expect(extractPurchase({ actions: [], action_values: [] } as any)).toEqual({ conversions: 0, conversionValue: 0 });
  });
});

describe('syncMetaGraph (mocked fetch)', () => {
  it('passes time_increment=1 and stores rows', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { campaign_id: '123', campaign_name: 'A', spend: '100.50', impressions: '5000', clicks: '100', actions: [{ action_type: 'purchase', value: '10' }], action_values: [{ action_type: 'purchase', value: '1500' }], date_start: '2026-04-01', date_stop: '2026-04-01' },
          { campaign_id: '123', campaign_name: 'A', spend: '200', impressions: '8000', clicks: '160', actions: [], action_values: [], date_start: '2026-04-02', date_stop: '2026-04-02' },
        ],
        paging: {},
      }),
    });
    const capturedValues: any[] = [];
    const fakeDb = {
      execute: vi.fn().mockResolvedValue({ rows: [] }),
      insert: vi.fn().mockReturnValue({
        values: (v: any) => { capturedValues.push(...v); return { onConflictDoUpdate: () => Promise.resolve(undefined) }; },
      }),
    };
    const result = await syncMetaGraph(
      { start: '2026-04-01', end: '2026-04-02' },
      { db: fakeDb as any, token: 'fake-token', accountId: 'act_123' }
    );
    expect(result.rowsWritten).toBe(2);
    const url = (global.fetch as any).mock.calls[0][0] as string;
    expect(url).toContain('time_increment=1');
    expect(url).toContain('act_123');
    expect(url).toContain('access_token=fake-token');
  });

  it('follows paging.next when present', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ campaign_id: '1', campaign_name: 'c', spend: '10', impressions: '1', clicks: '0', actions: [], action_values: [], date_start: '2026-04-01', date_stop: '2026-04-01' }], paging: { next: 'https://graph.facebook.com/v22.0/next-page' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ campaign_id: '2', campaign_name: 'c2', spend: '20', impressions: '1', clicks: '0', actions: [], action_values: [], date_start: '2026-04-01', date_stop: '2026-04-01' }], paging: {} }) });
    const fakeDb = {
      execute: vi.fn().mockResolvedValue({ rows: [] }),
      insert: () => ({ values: () => ({ onConflictDoUpdate: () => Promise.resolve() }) }),
    };
    const result = await syncMetaGraph(
      { start: '2026-04-01', end: '2026-04-01' },
      { db: fakeDb as any, token: 't', accountId: 'act_x' },
    );
    expect(result.rowsWritten).toBe(2);
    expect((global.fetch as any).mock.calls.length).toBe(2);
  });

  it('throws when token missing and env empty', async () => {
    await expect(syncMetaGraph(
      { start: '2026-04-01', end: '2026-04-01' },
      { db: {} as any, accountId: 'act_1' }
    )).rejects.toThrow(/META_GRAPH_API_TOKEN/);
  });
});
