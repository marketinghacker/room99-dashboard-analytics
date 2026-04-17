/**
 * GET /api/admin/order-peek?key=SECRET&source=allegro
 * Fetch ONE Allegro order from yesterday and dump full BaseLinker JSON
 * so we can see what price/discount fields are actually populated.
 */
import { BaseLinkerAPI } from '@/lib/sync/baselinker-api';
import { SOURCE_BUCKETS } from '@/lib/sync/sellrocket-direct';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  if (key !== secret) return new Response('Unauthorized', { status: 401 });

  const bucket = (url.searchParams.get('source') as 'shr' | 'allegro' | null) ?? 'allegro';
  const n = Number(url.searchParams.get('n') ?? 3);
  const token = process.env.BASELINKER_API_TOKEN;
  if (!token) return Response.json({ error: 'no token' }, { status: 500 });

  const api = new BaseLinkerAPI(token);
  const src = SOURCE_BUCKETS[bucket][0];

  // Pull from last 48h
  const toTs = Math.floor(Date.now() / 1000);
  const fromTs = toTs - 48 * 3600;

  const res: any = await api.call('getOrders', {
    date_confirmed_from: fromTs,
    filter_order_source: src.sourceType,
    filter_order_source_id: src.sourceId,
    get_unconfirmed_orders: false,
  });

  const orders = (res.orders ?? []).slice(0, n);
  return Response.json({
    bucket,
    source: src,
    count: orders.length,
    orders,
  });
}
