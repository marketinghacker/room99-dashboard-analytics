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
import { BaseLinkerAPI, orderRevenue } from '@/lib/sync/baselinker-api';
import { SOURCE_BUCKETS, BUCKET_STATUS_EXCLUDES, type Bucket } from '@/lib/sync/sellrocket-direct';
import { db } from '@/lib/db';
import { orderStatusConfig } from '@/lib/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  type Row = { status_id: number; label: string; count: number; revenue: number; excluded: boolean };
  const byStatus = new Map<number, Row>();

  for (const src of sources) {
    const all = await api.getOrdersRange({
      fromTs, toTs, sourceType: src.sourceType, sourceId: src.sourceId,
      dateField: 'add',
    });
    for (const o of all) {
      const sid = o.order_status_id;
      let r = byStatus.get(sid);
      if (!r) {
        r = {
          status_id: sid,
          label: labelById.get(sid) ?? `(unknown ${sid})`,
          count: 0,
          revenue: 0,
          excluded: excludes.has(sid),
        };
        byStatus.set(sid, r);
      }
      r.count += 1;
      r.revenue += orderRevenue(o);
    }
  }

  const rows = [...byStatus.values()].sort((a, b) => b.revenue - a.revenue);
  const totalIncluded = rows.filter((r) => !r.excluded).reduce((s, r) => s + r.revenue, 0);
  const totalExcluded = rows.filter((r) => r.excluded).reduce((s, r) => s + r.revenue, 0);
  const ordersIncluded = rows.filter((r) => !r.excluded).reduce((s, r) => s + r.count, 0);
  const ordersExcluded = rows.filter((r) => r.excluded).reduce((s, r) => s + r.count, 0);

  return Response.json({
    day,
    bucket,
    summary: {
      totalIncluded: Number(totalIncluded.toFixed(2)),
      totalExcluded: Number(totalExcluded.toFixed(2)),
      grand: Number((totalIncluded + totalExcluded).toFixed(2)),
      ordersIncluded,
      ordersExcluded,
      ordersGrand: ordersIncluded + ordersExcluded,
    },
    statuses: rows.map((r) => ({
      status_id: r.status_id,
      label: r.label,
      count: r.count,
      revenue: Number(r.revenue.toFixed(2)),
      excluded: r.excluded,
    })),
  });
}
