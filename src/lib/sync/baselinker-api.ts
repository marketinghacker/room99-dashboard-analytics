/**
 * Direct BaseLinker REST API client — bypasses the SellRocket MCP wrapper.
 *
 * MCP's `get_daily_revenue` silently drops `filter_order_source_id`, so
 * individual Allegro sub-accounts (Room99_Official, e_homeconcept, …) can't
 * be queried accurately. The official BaseLinker API respects the parameter.
 *
 * Auth: `X-BLToken` header.
 * Default endpoint: https://api.baselinker.com/connector.php
 * Override via BASELINKER_API_URL env var — Room99 uses a dedicated
 * SellRocket enterprise endpoint (https://*.enterprise.sellrocket.pl/connector.php).
 * Docs: https://api.baselinker.com/
 */
const DEFAULT_API_URL = 'https://api.baselinker.com/connector.php';

export type BaseLinkerOrder = {
  order_id: number;
  order_source: string;      // internal name e.g. 'ALLEGRO'
  order_source_id: number;   // numeric id e.g. 8 = Room99_Official
  date_confirmed: number;    // unix timestamp
  date_add: number;
  order_status_id: number;
  currency: string;
  delivery_price: number;
  payment_done: number;      // amount actually paid (post-discount); preferred over MSRP
  payment_method?: string;
  email?: string;
  products: Array<{
    product_id?: string;
    name: string;
    sku?: string;
    ean?: string;
    price_brutto: number;
    tax_rate: number;
    quantity: number;
  }>;
};

/**
 * Best-available revenue figure for an order. Empirical shape from 200 real
 * Room99 orders (100 SHR + 100 ALL) sampled on Apr 2026:
 *
 *   Shoper: 58% paid with delivery, 17% paid without, 25% paid=0 (pending)
 *   Allegro: 89% paid == products only, 11% paid incl. delivery, 0% paid=0
 *
 * Rule:
 *   - payment_done > 0 → honour it as-is (matches "Łączna wartość" in SellRocket)
 *   - payment_done = 0 → sum of products + delivery (what the customer owes)
 *
 * This gives 99.9% match on SHR vs user reference. Allegro runs ~+6% hot
 * vs SellRocket UI — that gap is NOT from delivery (99 zł/month noise), it's
 * order-status mix. Fix via /admin/statuses, not here.
 */
export function orderRevenue(o: BaseLinkerOrder): number {
  const paid = Number(o.payment_done ?? 0);
  if (paid > 0) return paid;
  const products = o.products.reduce((s, p) => s + p.price_brutto * p.quantity, 0);
  return products + Number(o.delivery_price ?? 0);
}

type GetOrdersResponse = {
  status: 'SUCCESS' | 'ERROR';
  error_code?: string;
  error_message?: string;
  orders?: BaseLinkerOrder[];
};

export class BaseLinkerAPI {
  private apiUrl: string;
  constructor(private token: string, apiUrl?: string) {
    if (!token) throw new Error('BaseLinker API token missing');
    this.apiUrl = apiUrl ?? process.env.BASELINKER_API_URL ?? DEFAULT_API_URL;
  }

  /**
   * One BaseLinker API call. Methods + parameters per the official docs.
   * Note: BaseLinker uses x-www-form-urlencoded with parameters JSON-encoded
   * in the `parameters` field.
   */
  async call<T = unknown>(method: string, parameters: Record<string, unknown> = {}): Promise<T> {
    const body = new URLSearchParams({
      method,
      parameters: JSON.stringify(parameters),
    });

    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'X-BLToken': this.token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!res.ok) {
      throw new Error(`BaseLinker HTTP ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { status?: string; error_message?: string } & T;
    if (data.status === 'ERROR') {
      throw new Error(`BaseLinker: ${data.error_message ?? 'unknown error'}`);
    }
    return data as T;
  }

  /**
   * Fetch all confirmed orders in [fromTs, toTs] filtered to a specific
   * order_source_id. Handles 100-per-page pagination via `id_from`.
   *
   * BaseLinker ties `date_confirmed_from` to pagination, so for a clean
   * day-range we iterate by ID until confirmed timestamp crosses `toTs`.
   */
  async getOrdersRange(opts: {
    fromTs: number;
    toTs: number;
    sourceId?: number;
    sourceType?: string;
    getUnconfirmed?: boolean;
  }): Promise<BaseLinkerOrder[]> {
    const orders: BaseLinkerOrder[] = [];
    let idFrom = 0;
    const dateConfirmedFrom = opts.fromTs;
    let iterations = 0;
    let batchesWithNoMatchInRange = 0;

    while (iterations++ < 5000) {
      const params: Record<string, unknown> = {
        date_confirmed_from: dateConfirmedFrom,
        get_unconfirmed_orders: opts.getUnconfirmed ? true : false,
      };
      if (idFrom > 0) params.id_from = idFrom;
      // BaseLinker REQUIRES filter_order_source (string category) to be set
      // before filter_order_source_id (numeric) — otherwise it errors.
      if (opts.sourceType) params.filter_order_source = opts.sourceType;
      if (opts.sourceId !== undefined) params.filter_order_source_id = opts.sourceId;

      const res = await this.call<GetOrdersResponse>('getOrders', params);
      const batch = res.orders ?? [];
      if (batch.length === 0) break;

      // BaseLinker returns batches sorted by order_id ASC, but `date_confirmed`
      // can be in any order within the batch (orders confirmed retroactively).
      // We must NOT early-return on a single out-of-range row — keep collecting.
      let matchedThisBatch = 0;
      let allBeforeRange = true;
      let allAfterRange = true;
      for (const o of batch) {
        if (o.date_confirmed >= opts.fromTs && o.date_confirmed <= opts.toTs) {
          orders.push(o);
          matchedThisBatch++;
        }
        if (o.date_confirmed >= opts.fromTs) allBeforeRange = false;
        if (o.date_confirmed <= opts.toTs) allAfterRange = false;
      }

      // Stopping heuristic: if 5 consecutive batches all > toTs and we have
      // some matches already, we've gone past the range.
      if (allAfterRange) {
        batchesWithNoMatchInRange++;
        if (batchesWithNoMatchInRange >= 5 && orders.length > 0) break;
      } else {
        batchesWithNoMatchInRange = 0;
      }
      void matchedThisBatch;
      void allBeforeRange;

      if (batch.length < 100) break;
      const lastOrder = batch[batch.length - 1];
      idFrom = lastOrder.order_id + 1;
    }
    return orders;
  }

  /**
   * Aggregate daily revenue per source for a date range. Returns
   * [{date, sourceId, orders, revenue, avgOrderValue}].
   */
  async dailyRevenueBySource(opts: {
    start: string;  // YYYY-MM-DD
    end: string;    // YYYY-MM-DD
    sources: Array<{ sourceType: string; sourceId: number }>;
  }): Promise<Array<{ date: string; sourceId: number; orders: number; revenue: number }>> {
    const fromTs = Math.floor(new Date(opts.start + 'T00:00:00Z').getTime() / 1000);
    const toTs = Math.floor(new Date(opts.end + 'T23:59:59Z').getTime() / 1000);

    const results: Array<{ date: string; sourceId: number; orders: number; revenue: number }> = [];
    for (const { sourceType, sourceId } of opts.sources) {
      const all = await this.getOrdersRange({ fromTs, toTs, sourceType, sourceId });
      const byDate = new Map<string, { orders: number; revenue: number }>();
      for (const o of all) {
        const d = new Date(o.date_confirmed * 1000).toISOString().slice(0, 10);
        const revenue = orderRevenue(o);
        let e = byDate.get(d);
        if (!e) { e = { orders: 0, revenue: 0 }; byDate.set(d, e); }
        e.orders++;
        e.revenue += revenue;
      }
      for (const [date, agg] of byDate) {
        results.push({ date, sourceId, ...agg });
      }
    }
    return results;
  }
}
