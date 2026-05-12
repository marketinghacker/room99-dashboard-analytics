/**
 * GET /api/admin/status-breakdown?key=SECRET&day=YYYY-MM-DD&source=allegro
 *
 * Diagnostic: pulls every order matching `source` for one PL day via the same
 * BaseLinker call our sync uses (date_add + get_unconfirmed_orders=true), then
 * shows the per-status_id breakdown — count, revenue, and whether we currently
 * include or exclude that status.
 *
 * Used to debug "dashboard < SellRocket UI" gaps after the date_add migration.
 * If a status appears with high revenue and `excluded=true`, it's a candidate
 * to remove from BUCKET_STATUS_EXCLUDES.
 */
import { BaseLinkerAPI, orderRevenue, type BaseLinkerOrder } from '@/lib/sync/baselinker-api';
import { SOURCE_BUCKETS, BUCKET_STATUS_EXCLUDES, type Bucket } from '@/lib/sync/sellrocket-direct';
import { db } from '@/lib/db';
import { orderStatusConfig } from '@/lib/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Five candidate revenue formulas — for matching SellRocket UI exactly.
 * SellRocket exports show Total = TotalShipment + TotalWithoutShipment, so
 * "Total" includes shipping. The question is whether SR uses payment_done or
 * products+delivery (and how it handles unpaid orders).
 */
const FORMULAS = {
  /** A: payment_done as-is, including 0 for unpaid orders. */
  paymentDoneRaw: (o: BaseLinkerOrder) => Number(o.payment_done ?? 0),
  /** B: payment_done, but skip orders where it's 0 (unpaid → not yet a sale). */
  paymentDoneSkipZeros: (o: BaseLinkerOrder) => {
    const v = Number(o.payment_done ?? 0);
    return v > 0 ? v : 0;
  },
  /** C: always sum products * quantity + delivery_price. */
  productsPlusDelivery: (o: BaseLinkerOrder) =>
    o.products.reduce((s, p) => s + p.price_brutto * p.quantity, 0) + Number(o.delivery_price ?? 0),
  /** D: just products * quantity, no delivery. */
  productsOnly: (o: BaseLinkerOrder) =>
    o.products.reduce((s, p) => s + p.price_brutto * p.quantity, 0),
  /** E: current orderRevenue() — payment_done if >0, else products+delivery. */
  current: (o: BaseLinkerOrder) => orderRevenue(o),
};

type FormulaName = keyof typeof FORMULAS;
const FORMULA_NAMES: FormulaName[] = ['paymentDoneRaw', 'paymentDoneSkipZeros', 'productsPlusDelivery', 'productsOnly', 'current'];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  if (key !== secret) return new Response('Unauthorized', { status: 401 });

  const day = url.searchParams.get('day');
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return Response.json({ error: 'day=YYYY-MM-DD required' }, { status: 400 });
  }
  const bucket = (url.searchParams.get('source') as Bucket | null) ?? 'allegro';
  if (!(bucket in SOURCE_BUCKETS)) {
    return Response.json({ error: `unknown source ${bucket}` }, { status: 400 });
  }

  const token = process.env.BASELINKER_API_TOKEN;
  if (!token) return Response.json({ error: 'BASELINKER_API_TOKEN missing' }, { status: 500 });

  const api = new BaseLinkerAPI(token);
  const sources = SOURCE_BUCKETS[bucket];
  const excludes = BUCKET_STATUS_EXCLUDES[bucket];

  const fromTs = Math.floor(new Date(day + 'T00:00:00Z').getTime() / 1000);
  const toTs = Math.floor(new Date(day + 'T23:59:59Z').getTime() / 1000);

  // Status id → label from order_status_config
  const labelRows = await db.select().from(orderStatusConfig);
  const labelById = new Map(labelRows.map((r) => [r.statusId, r.label]));

  type Row = {
    status_id: number;
    label: string;
    count: number;
    excluded: boolean;
    /** Per-formula revenue total for this status. */
    revenue: Record<FormulaName, number>;
  };
  const byStatus = new Map<number, Row>();
  const allOrders: BaseLinkerOrder[] = [];
  let totalShipment = 0;

  for (const src of sources) {
    const all = await api.getOrdersRange({
      fromTs, toTs, sourceType: src.sourceType, sourceId: src.sourceId,
      dateField: 'add',
    });
    allOrders.push(...all);
    for (const o of all) {
      const sid = o.order_status_id;
      let r = byStatus.get(sid);
      if (!r) {
        r = {
          status_id: sid,
          label: labelById.get(sid) ?? `(unknown ${sid})`,
          count: 0,
          excluded: excludes.has(sid),
          revenue: { paymentDoneRaw: 0, paymentDoneSkipZeros: 0, productsPlusDelivery: 0, productsOnly: 0, current: 0 },
        };
        byStatus.set(sid, r);
      }
      r.count += 1;
      for (const name of FORMULA_NAMES) r.revenue[name] += FORMULAS[name](o);
      totalShipment += Number(o.delivery_price ?? 0);
    }
  }

  // Aggregate by formula (included only / all orders / excluded only).
  const sumBy = (filter: (r: Row) => boolean): Record<FormulaName, number> => {
    const out: Record<FormulaName, number> = {
      paymentDoneRaw: 0, paymentDoneSkipZeros: 0, productsPlusDelivery: 0, productsOnly: 0, current: 0,
    };
    for (const r of byStatus.values()) {
      if (!filter(r)) continue;
      for (const name of FORMULA_NAMES) out[name] += r.revenue[name];
    }
    return out;
  };
  const includedSum = sumBy((r) => !r.excluded);
  const excludedSum = sumBy((r) => r.excluded);
  const grandSum = sumBy(() => true);

  const rows = [...byStatus.values()].sort((a, b) => b.revenue.current - a.revenue.current);
  const ordersIncluded = rows.filter((r) => !r.excluded).reduce((s, r) => s + r.count, 0);
  const ordersExcluded = rows.filter((r) => r.excluded).reduce((s, r) => s + r.count, 0);

  const round = (o: Record<string, number>): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(o)) out[k] = Number(v.toFixed(2));
    return out;
  };

  return Response.json({
    day,
    bucket,
    summary: {
      ordersGrand: ordersIncluded + ordersExcluded,
      ordersIncluded,
      ordersExcluded,
      totalShipment: Number(totalShipment.toFixed(2)),
      revenueByFormula: {
        included: round(includedSum),
        excluded: round(excludedSum),
        grand: round(grandSum),
      },
    },
    statuses: rows.map((r) => ({
      status_id: r.status_id,
      label: r.label,
      count: r.count,
      excluded: r.excluded,
      revenue: round(r.revenue),
    })),
  });
}
