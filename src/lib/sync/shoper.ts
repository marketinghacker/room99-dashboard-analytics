/**
 * Direct Shoper REST API sync.
 *
 * Why this exists: BaseLinker/SellRocket rotates orders out of `getOrders`
 * after ~365 days. Querying BaseLinker for 2025-04 returns zero usable rows
 * — data's gone. The Shoper shop itself keeps the full history (back to
 * 2016 for Room99) in its own DB, so for YoY comparison we pull directly.
 *
 * Auth: POST /webapi/rest/auth with HTTP Basic → returns a 30-day bearer token.
 * Then all subsequent calls pass `Authorization: Bearer <token>`.
 *
 * Docs: https://developers.shoper.pl/developers/api/
 *
 * Target: writes into `products_daily` with `source = 'shr'` so Shoper rows
 * show up in the "Shoper" column of /api/data/top-products. We only use
 * this for historical ranges (sellrocket owns current-period SHR data);
 * there's no PK collision because the sellrocket purge range is disjoint
 * from the Shoper backfill range.
 */
import { sql } from 'drizzle-orm';
import { db as defaultDb, type DB } from '@/lib/db';
import { productsDaily } from '@/lib/schema';
import { parseSkuToCategoryCollection } from './sku-parser';
import { type DateRange } from '@/lib/periods';

const DEFAULT_BASE = process.env.SHOPER_SHOP_URL || 'https://sklep661879.shoparena.pl';

export type ShoperOrder = {
  order_id: string;
  date: string;              // 'YYYY-MM-DD HH:MM:SS'
  status_id: string;
  sum: string;               // gross total
  paid: string;              // actual paid (post-discount, post-refund)
  shipping_cost: string;
  currency_id: string;
};

export type ShoperOrderProduct = {
  id: string;
  order_id: string;
  product_id: string;
  stock_id: string;
  price: string;             // unit price, gross
  discount_perc: string;     // e.g. '0.0000'
  quantity: string;
  name: string;
  code: string;              // SKU/EAN
  ean?: string;
  tax: string;               // e.g. '23%'
  images?: {
    thumbnail?: { url?: string; is_placeholder?: boolean };
    main?:      { url?: string; is_placeholder?: boolean };
  };
};

type ListResponse<T> = {
  count: string;
  pages: number;
  page: number;
  list: T[];
};

export class ShoperAPI {
  private base: string;
  private token: string | null = null;
  private tokenExpiresAt = 0;
  private user: string;
  private password: string;

  constructor(opts: { base?: string; user: string; password: string }) {
    this.base = (opts.base ?? DEFAULT_BASE).replace(/\/+$/, '');
    this.user = opts.user;
    this.password = opts.password;
  }

  private async auth(): Promise<void> {
    // Reuse existing token until 30s before expiry.
    if (this.token && this.tokenExpiresAt > Date.now() + 30_000) return;

    const basic = Buffer.from(`${this.user}:${this.password}`).toString('base64');
    const res = await fetch(`${this.base}/webapi/rest/auth`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}` },
    });
    if (!res.ok) throw new Error(`Shoper auth failed: HTTP ${res.status} — ${await res.text().catch(() => '')}`);
    const j = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) throw new Error(`Shoper auth: no access_token in response`);
    this.token = j.access_token;
    this.tokenExpiresAt = Date.now() + Math.max(0, (j.expires_in ?? 2_592_000) - 60) * 1000;
  }

  private async get<T>(path: string, params: Record<string, string | number | object>): Promise<T> {
    await this.auth();
    const u = new URL(`${this.base}/webapi/rest${path}`);
    for (const [k, v] of Object.entries(params)) {
      u.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
    const res = await fetch(u.toString(), {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Shoper ${path} HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  /**
   * Paginate orders in a date range. Shoper caps limit at 50.
   * Nested-operator filter syntax: `{ "date": { ">=": "YYYY-MM-DD ...", "<=": "..." } }`.
   */
  async *iterateOrders(start: string, end: string): AsyncGenerator<ShoperOrder, void, void> {
    const filters = {
      date: { '>=': `${start} 00:00:00`, '<=': `${end} 23:59:59` },
    };
    let page = 1;
    while (true) {
      const res = await this.get<ListResponse<ShoperOrder>>('/orders', {
        filters,
        limit: 50,
        page,
      });
      for (const o of res.list) yield o;
      if (!res.list.length || page >= res.pages) break;
      page += 1;
    }
  }

  /**
   * Paginate order_products for a specific order_id range (inclusive).
   * Returns line items with product name, SKU (`code`), and thumbnail URL.
   */
  async *iterateOrderProducts(minOrderId: number, maxOrderId: number): AsyncGenerator<ShoperOrderProduct, void, void> {
    const filters = { order_id: { '>=': String(minOrderId), '<=': String(maxOrderId) } };
    let page = 1;
    while (true) {
      const res = await this.get<ListResponse<ShoperOrderProduct>>('/order-products', {
        filters,
        limit: 50,
        page,
      });
      for (const p of res.list) yield p;
      if (!res.list.length || page >= res.pages) break;
      page += 1;
    }
  }
}

type Agg = {
  date: string;
  sku: string;
  productName: string;
  category: string | null;
  collection: string | null;
  quantity: number;
  revenue: number;
  orderIds: Set<string>;
  thumbnailUrl: string | null;
};

/**
 * Best-effort revenue per order line (matches BaseLinker's `orderRevenue`).
 * Shoper returns price as unit gross. Revenue per line = price × quantity,
 * trusting the order-level `paid` vs `sum` for discount reconciliation at
 * the product_id × day grain (not per order).
 */
function lineRevenue(p: ShoperOrderProduct): number {
  const price = Number(p.price ?? 0);
  const qty = Number(p.quantity ?? 0);
  const discount = Number(p.discount_perc ?? 0);
  const discountedUnit = discount > 0 ? price * (1 - discount / 100) : price;
  return discountedUnit * qty;
}

/**
 * Sync Shoper orders + products for a date range into products_daily.
 * Writes with source='shr' — only safe for ranges where sellrocket has no
 * SHR data (i.e., older than ~365 days where BaseLinker purged its copy).
 */
export async function syncShoperHistorical(
  range: DateRange,
  opts: { db?: DB; user?: string; password?: string; base?: string } = {},
): Promise<{ rowsWritten: number }> {
  const database = opts.db ?? defaultDb;

  const user = opts.user ?? process.env.SHOPER_API_USER;
  const password = opts.password ?? process.env.SHOPER_API_PASSWORD;
  if (!user || !password) {
    throw new Error('SHOPER_API_USER / SHOPER_API_PASSWORD missing — set in env');
  }
  const api = new ShoperAPI({ user, password, base: opts.base });

  const t0 = Date.now();

  // Step 1: fetch all orders in range, extract (order_id → date, paid).
  // We'll need `date` from the order for time-series aggregation, and
  // `paid` for status filtering (Shoper has different status_ids than
  // BaseLinker, so for now we include any order with paid > 0 OR sum > 0).
  const orderById = new Map<string, { date: string; paid: number; sum: number }>();
  let minOrderId = Number.POSITIVE_INFINITY;
  let maxOrderId = Number.NEGATIVE_INFINITY;
  let orderCount = 0;
  for await (const o of api.iterateOrders(range.start, range.end)) {
    const id = Number(o.order_id);
    if (!Number.isFinite(id)) continue;
    if (id < minOrderId) minOrderId = id;
    if (id > maxOrderId) maxOrderId = id;
    orderById.set(o.order_id, {
      date: o.date.slice(0, 10),
      paid: Number(o.paid ?? 0),
      sum: Number(o.sum ?? 0),
    });
    orderCount++;
  }
  console.log(`[shoper] orders in ${range.start}..${range.end}: ${orderCount}  (order_id ${minOrderId}..${maxOrderId})`);
  if (orderCount === 0) return { rowsWritten: 0 };

  // Step 2: fetch all order_products for that order_id range.
  // Shoper indexes order-products by order_id cheaply, and Shoper order_ids
  // are monotonically increasing — so a (minId, maxId) filter bounds the
  // query tightly. A few trailing ids outside our date range may leak in
  // if the shop is busy, but we filter them out via the orderById map.
  const agg = new Map<string, Agg>();
  let lineCount = 0;
  for await (const p of api.iterateOrderProducts(minOrderId, maxOrderId)) {
    const meta = orderById.get(p.order_id);
    if (!meta) continue;  // Outside our date range (possible pagination overshoot)
    // Filter out orders with paid=0 and sum=0 (carts, drafts).
    if (meta.paid <= 0 && meta.sum <= 0) continue;

    const skuRaw = (p.code ?? p.ean ?? '').trim();
    const sku = skuRaw || `shoper-product-${p.product_id}`;

    const key = `${meta.date}|${sku}`;
    let e = agg.get(key);
    if (!e) {
      const parsed = parseSkuToCategoryCollection(p.name ?? '');
      e = {
        date: meta.date,
        sku,
        productName: p.name ?? '',
        category: parsed.category,
        collection: parsed.collection,
        quantity: 0,
        revenue: 0,
        orderIds: new Set<string>(),
        thumbnailUrl: p.images?.thumbnail?.url && !p.images.thumbnail.is_placeholder
          ? p.images.thumbnail.url
          : null,
      };
      agg.set(key, e);
    }
    e.quantity += Number(p.quantity ?? 0);
    e.revenue += lineRevenue(p);
    e.orderIds.add(p.order_id);
    lineCount++;
  }
  console.log(`[shoper] order_products: ${lineCount} lines → ${agg.size} (date,sku) rows`);

  // Step 3: wipe + bulk upsert with source='shr'.
  await database.execute(sql`
    DELETE FROM products_daily
    WHERE date BETWEEN ${range.start} AND ${range.end}
      AND source = 'shr'
  `);

  const rows = Array.from(agg.values()).map((e) => ({
    date: e.date,
    sku: e.sku,
    productName: e.productName,
    category: e.category,
    collection: e.collection,
    source: 'shr',
    quantity: e.quantity,
    revenue: e.revenue.toFixed(4),
    orders: e.orderIds.size,
    thumbnailUrl: e.thumbnailUrl,
  }));

  let rowsWritten = 0;
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    if (slice.length === 0) continue;
    await database.insert(productsDaily).values(slice).onConflictDoUpdate({
      target: [productsDaily.date, productsDaily.sku, productsDaily.source],
      set: {
        productName: sql`excluded.product_name`,
        category: sql`excluded.category`,
        collection: sql`excluded.collection`,
        quantity: sql`excluded.quantity`,
        revenue: sql`excluded.revenue`,
        orders: sql`excluded.orders`,
        thumbnailUrl: sql`excluded.thumbnail_url`,
        updatedAt: sql`now()`,
      },
    });
    rowsWritten += slice.length;
  }

  console.log(`[shoper] total ${rowsWritten} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { rowsWritten };
}

/**
 * Aggregate Shoper orders into `sellrocket_daily` shape for the `shr` bucket.
 * Used to back-fill the Shoper-vs-Allegro comparison chart for historical
 * ranges where BaseLinker has already purged orders.
 *
 * Returns { rowsWritten } (one row per date).
 */
export async function syncShoperDailyRevenue(
  range: DateRange,
  opts: { db?: DB; user?: string; password?: string; base?: string } = {},
): Promise<{ rowsWritten: number }> {
  const database = opts.db ?? defaultDb;
  const user = opts.user ?? process.env.SHOPER_API_USER;
  const password = opts.password ?? process.env.SHOPER_API_PASSWORD;
  if (!user || !password) {
    throw new Error('SHOPER_API_USER / SHOPER_API_PASSWORD missing — set in env');
  }
  const api = new ShoperAPI({ user, password, base: opts.base });

  const perDay = new Map<string, { revenue: number; orders: number }>();
  for await (const o of api.iterateOrders(range.start, range.end)) {
    const paid = Number(o.paid ?? 0);
    const sum = Number(o.sum ?? 0);
    const rev = paid > 0 ? paid : sum;
    if (rev <= 0) continue;
    const d = o.date.slice(0, 10);
    let e = perDay.get(d);
    if (!e) { e = { revenue: 0, orders: 0 }; perDay.set(d, e); }
    e.revenue += rev;
    e.orders += 1;
  }

  // Upsert into sellrocket_daily with source='shr'. Wipe+replace in-range
  // since sellrocket itself owns 'shr' for current data; Shoper is only
  // used on historical ranges where sellrocket would be empty anyway.
  await database.execute(sql`
    DELETE FROM sellrocket_daily
    WHERE date BETWEEN ${range.start} AND ${range.end}
      AND source = 'shr'
  `);

  let rowsWritten = 0;
  for (const [date, e] of perDay) {
    await database.execute(sql`
      INSERT INTO sellrocket_daily (date, source, order_count, revenue)
      VALUES (${date}, 'shr', ${e.orders}, ${e.revenue.toFixed(4)})
      ON CONFLICT (date, source) DO UPDATE SET
        order_count = EXCLUDED.order_count,
        revenue     = EXCLUDED.revenue
    `);
    rowsWritten++;
  }

  console.log(`[shoper/daily] ${rowsWritten} dates, ${Array.from(perDay.values()).reduce((s, e) => s + e.orders, 0)} orders`);
  return { rowsWritten };
}
