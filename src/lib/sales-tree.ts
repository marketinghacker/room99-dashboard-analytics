export type FlatRow = {
  source: string;
  category: string;
  collection: string;
  sku: string;
  product_name: string;
  revenue: number;
  quantity: number;
  orders: number;
  revenue_prev: number;
  daily: number[]; // daily revenue, length = period days
};

export type Metrics = {
  revenue: number;
  quantity: number;
  orders: number;
  revenuePrev: number;
  change: number; // % vs prev
};

export type ProductNode = { sku: string; name: string; metrics: Metrics; daily: number[] };
export type CollectionNode = { collection: string; metrics: Metrics; daily: number[]; products: ProductNode[] };
export type CategoryNode = { category: string; metrics: Metrics; daily: number[]; collections: CollectionNode[] };
export type ChannelNode = { source: string; metrics: Metrics; daily: number[]; categories: CategoryNode[] };

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

function sumDaily(arrays: number[][]): number[] {
  if (arrays.length === 0) return [];
  const len = Math.max(...arrays.map(a => a.length));
  const out = new Array(len).fill(0);
  for (const arr of arrays) {
    for (let i = 0; i < arr.length; i++) out[i] += arr[i];
  }
  return out;
}

export function buildSalesTree(rows: FlatRow[]): ChannelNode[] {
  const channelMap = new Map<string, Map<string, Map<string, FlatRow[]>>>();
  for (const r of rows) {
    if (!channelMap.has(r.source)) channelMap.set(r.source, new Map());
    const cat = channelMap.get(r.source)!;
    if (!cat.has(r.category)) cat.set(r.category, new Map());
    const col = cat.get(r.category)!;
    if (!col.has(r.collection)) col.set(r.collection, []);
    col.get(r.collection)!.push(r);
  }

  const channels: ChannelNode[] = [];
  for (const [source, catMap] of channelMap) {
    const categories: CategoryNode[] = [];
    for (const [category, colMap] of catMap) {
      const collections: CollectionNode[] = [];
      for (const [collection, productRows] of colMap) {
        const products: ProductNode[] = productRows.map(r => ({
          sku: r.sku,
          name: r.product_name,
          daily: r.daily,
          metrics: {
            revenue: r.revenue, quantity: r.quantity, orders: r.orders,
            revenuePrev: r.revenue_prev, change: pctChange(r.revenue, r.revenue_prev),
          },
        }));
        products.sort((a, b) => b.metrics.revenue - a.metrics.revenue);
        const colRev = products.reduce((s, p) => s + p.metrics.revenue, 0);
        const colPrev = products.reduce((s, p) => s + p.metrics.revenuePrev, 0);
        collections.push({
          collection, products, daily: sumDaily(products.map(p => p.daily)),
          metrics: {
            revenue: colRev,
            quantity: products.reduce((s, p) => s + p.metrics.quantity, 0),
            orders: products.reduce((s, p) => s + p.metrics.orders, 0),
            revenuePrev: colPrev, change: pctChange(colRev, colPrev),
          },
        });
      }
      collections.sort((a, b) => b.metrics.revenue - a.metrics.revenue);
      const catRev = collections.reduce((s, c) => s + c.metrics.revenue, 0);
      const catPrev = collections.reduce((s, c) => s + c.metrics.revenuePrev, 0);
      categories.push({
        category, collections, daily: sumDaily(collections.map(c => c.daily)),
        metrics: {
          revenue: catRev,
          quantity: collections.reduce((s, c) => s + c.metrics.quantity, 0),
          orders: collections.reduce((s, c) => s + c.metrics.orders, 0),
          revenuePrev: catPrev, change: pctChange(catRev, catPrev),
        },
      });
    }
    categories.sort((a, b) => b.metrics.revenue - a.metrics.revenue);
    const chRev = categories.reduce((s, c) => s + c.metrics.revenue, 0);
    const chPrev = categories.reduce((s, c) => s + c.metrics.revenuePrev, 0);
    channels.push({
      source, categories, daily: sumDaily(categories.map(c => c.daily)),
      metrics: {
        revenue: chRev,
        quantity: categories.reduce((s, c) => s + c.metrics.quantity, 0),
        orders: categories.reduce((s, c) => s + c.metrics.orders, 0),
        revenuePrev: chPrev, change: pctChange(chRev, chPrev),
      },
    });
  }
  channels.sort((a, b) => b.metrics.revenue - a.metrics.revenue);
  return channels;
}
