/**
 * Pinned-down tests for the BaseLinker API client — specifically the
 * `dateField` switch that controls whether we filter by `date_add` (order
 * placement, matches SellRocket UI) or `date_confirmed` (Allegro confirmation,
 * lags 12-48h). Migrating from `confirmed` to `add` was a 50%+ revenue swing
 * for "today" Allegro on Room99 — we need these guards locked.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseLinkerAPI } from './baselinker-api';

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

function makeOrder(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    order_id: 1,
    order_source: 'ALLEGRO',
    order_source_id: 8,
    date_add: 1715040000,        // 2024-05-07 00:00:00 UTC
    date_confirmed: 1715126400,  // 2024-05-08 00:00:00 UTC (24h lag)
    order_status_id: 1664,
    currency: 'PLN',
    delivery_price: 0,
    payment_done: 100,
    products: [],
    ...overrides,
  };
}

function decodeParams(body: BodyInit | null | undefined): Record<string, unknown> {
  if (!body) return {};
  const usp = new URLSearchParams(body as string);
  const params = JSON.parse(usp.get('parameters') ?? '{}');
  return params;
}

describe('BaseLinkerAPI.getOrdersRange', () => {
  let calls: Array<{ method: string; params: Record<string, unknown> }>;
  let respond: (params: Record<string, unknown>) => unknown[];

  beforeEach(() => {
    calls = [];
    // Default: no orders → ends pagination on first call.
    respond = () => [];

    vi.stubGlobal('fetch', vi.fn(async (_url: FetchInput, init: FetchInit) => {
      const body = init?.body as string;
      const usp = new URLSearchParams(body);
      const method = usp.get('method') ?? '';
      const params = decodeParams(body);
      calls.push({ method, params });
      const orders = respond(params);
      return new Response(JSON.stringify({ status: 'SUCCESS', orders }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));
  });

  it('defaults to dateField=add (SellRocket UI semantics)', async () => {
    const api = new BaseLinkerAPI('test-token', 'https://example.invalid/connector.php');
    await api.getOrdersRange({
      fromTs: 1714867200,  // 2024-05-05 UTC
      toTs:   1714953599,  // 2024-05-05 23:59 UTC
    });

    expect(calls.length).toBeGreaterThan(0);
    const params = calls[0].params;
    expect(params.date_from).toBe(1714867200);
    expect(params.date_confirmed_from).toBeUndefined();
    expect(params.get_unconfirmed_orders).toBe(true);
  });

  it('uses date_confirmed_from when dateField=confirmed', async () => {
    const api = new BaseLinkerAPI('test-token', 'https://example.invalid/connector.php');
    await api.getOrdersRange({
      fromTs: 1714867200,
      toTs:   1714953599,
      dateField: 'confirmed',
    });

    const params = calls[0].params;
    expect(params.date_confirmed_from).toBe(1714867200);
    expect(params.date_from).toBeUndefined();
    expect(params.get_unconfirmed_orders).toBe(false);
  });

  it('post-filters by date_add when dateField=add', async () => {
    // Window: 2024-05-07 PL day — UTC range 2024-05-06 22:00 → 2024-05-07 22:00
    // Order A: date_add IN range, date_confirmed OUT → MUST be included (we use date_add)
    // Order B: date_add OUT,       date_confirmed IN → MUST be excluded
    const inRangeAdd = 1715040000;     // 2024-05-07 00:00 UTC
    const outOfRangeAdd = 1715212800;  // 2024-05-09 00:00 UTC
    const inRangeConfirmed = 1715040000;
    const outOfRangeConfirmed = 1715212800;

    respond = () => [
      makeOrder({ order_id: 1, date_add: inRangeAdd,    date_confirmed: outOfRangeConfirmed }),
      makeOrder({ order_id: 2, date_add: outOfRangeAdd, date_confirmed: inRangeConfirmed }),
    ];

    const api = new BaseLinkerAPI('test-token', 'https://example.invalid/connector.php');
    const orders = await api.getOrdersRange({
      fromTs: 1715040000,
      toTs:   1715126399,
      dateField: 'add',
    });

    expect(orders.map((o) => o.order_id)).toEqual([1]);
  });

  it('post-filters by date_confirmed when dateField=confirmed', async () => {
    respond = () => [
      makeOrder({ order_id: 1, date_add: 1715040000, date_confirmed: 1715212800 }),  // confirm OUT
      makeOrder({ order_id: 2, date_add: 1715212800, date_confirmed: 1715040000 }),  // confirm IN
    ];

    const api = new BaseLinkerAPI('test-token', 'https://example.invalid/connector.php');
    const orders = await api.getOrdersRange({
      fromTs: 1715040000,
      toTs:   1715126399,
      dateField: 'confirmed',
    });

    expect(orders.map((o) => o.order_id)).toEqual([2]);
  });

  it('skips orders with date_confirmed=0 in confirmed mode (unconfirmed orders)', async () => {
    respond = () => [
      makeOrder({ order_id: 1, date_add: 1715040000, date_confirmed: 0 }),
      makeOrder({ order_id: 2, date_add: 1715040000, date_confirmed: 1715040000 }),
    ];

    const api = new BaseLinkerAPI('test-token', 'https://example.invalid/connector.php');
    const orders = await api.getOrdersRange({
      fromTs: 1715040000,
      toTs:   1715126399,
      dateField: 'confirmed',
    });

    expect(orders.map((o) => o.order_id)).toEqual([2]);
  });

  it('passes filter_order_source + filter_order_source_id together', async () => {
    const api = new BaseLinkerAPI('test-token', 'https://example.invalid/connector.php');
    await api.getOrdersRange({
      fromTs: 1715040000,
      toTs:   1715126399,
      sourceType: 'ALL',
      sourceId: 8,
    });

    const params = calls[0].params;
    expect(params.filter_order_source).toBe('ALL');
    expect(params.filter_order_source_id).toBe(8);
  });
});
