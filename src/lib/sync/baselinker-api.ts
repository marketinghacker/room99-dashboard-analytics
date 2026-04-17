/**
 * Direct BaseLinker REST API client — bypasses the SellRocket MCP wrapper.
 *
 * MCP's `get_daily_revenue` silently drops `filter_order_source_id`, so
 * individual Allegro sub-accounts (Room99_Official, e_homeconcept, …) can't
 * be queried accurately. The official BaseLinker API respects the parameter.
 *
 * Auth: `X-BLToken` header (create in BaseLinker → My Account → API).
 * Docs: https://api.baselinker.com/
 */
const API_URL = 'https://api.baselinker.com/connector.php';

export type BaseLinkerOrder = {
  order_id: number;
  order_source: string;      // internal name e.g. 'ALLEGRO'
  order_source_id: number;   // numeric id e.g. 8 = Room99_Official
  date_confirmed: number;    // unix timestamp
  date_add: number;
  order_status_id: number;
  currency: string;
  delivery_price: number;
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

type GetOrdersResponse = {
  status: 'SUCCESS' | 'ERROR';
  error_code?: string;
  error_message?: string;
  orders?: BaseLinkerOrder[];
};

export class BaseLinkerAPI {
  constructor(private token: string) {
    if (!token) throw new Error('BaseLinker API token missing');
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

    const res = await fetch(API_URL, {
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
    let dateConfirmedFrom = opts.fromTs;
    let iterations = 0;

    while (iterations++ < 500) {
      const params: Record<string, unknown> = {
        date_confirmed_from: dateConfirmedFrom,
        get_unconfirmed_orders: opts.getUnconfirmed ? true : false,
      };
      if (idFrom > 0) params.id_from = idFrom;
      if (opts.sourceId !== undefined) params.filter_order_source_id = opts.sourceId;
      if (opts.sourceType) params.filter_order_source = opts.sourceType;

      const res = await this.call<GetOrdersResponse>('getOrders', params);
      const batch = res.orders ?? [];
      if (batch.length === 0) break;

      for (const o of batch) {
        if (o.date_confirmed > opts.toTs) {
          return orders; // crossed upper bound
        }
        if (o.date_confirmed >= opts.fromTs) orders.push(o);
      }

      // If fewer than 100 orders, we've reached the end.
      if (batch.length < 100) break;

      // Next page: advance id_from to last order's id + 1.
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
    sourceIds: number[];
  }): Promise<Array<{ date: string; sourceId: number; orders: number; revenue: number }>> {
    const fromTs = Math.floor(new Date(opts.start + 'T00:00:00Z').getTime() / 1000);
    const toTs = Math.floor(new Date(opts.end + 'T23:59:59Z').getTime() / 1000);

    const results: Array<{ date: string; sourceId: number; orders: number; revenue: number }> = [];
    for (const sourceId of opts.sourceIds) {
      const all = await this.getOrdersRange({ fromTs, toTs, sourceId });
      const byDate = new Map<string, { orders: number; revenue: number }>();
      for (const o of all) {
        const d = new Date(o.date_confirmed * 1000).toISOString().slice(0, 10);
        const revenue = o.products.reduce((s, p) => s + p.price_brutto * p.quantity, 0) + Number(o.delivery_price ?? 0);
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
