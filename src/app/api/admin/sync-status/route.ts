/**
 * GET /api/admin/sync-status?key=SECRET
 * Lists the last 40 sync_runs (most recent first) so you can monitor
 * long-running backfills and cron health.
 */
import { db } from '@/lib/db';
import { syncRuns, sellrocketDaily } from '@/lib/schema';
import { desc, sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  if (key !== secret) return new Response('Unauthorized', { status: 401 });

  const runs = await db
    .select()
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(40);

  const srStats: any = await db.execute(sql`
    SELECT source,
      COUNT(*) FILTER (WHERE revenue > 0) AS nonzero_days,
      MIN(date) FILTER (WHERE revenue > 0) AS first_day,
      MAX(date) FILTER (WHERE revenue > 0) AS last_day,
      SUM(revenue)::float AS total_revenue,
      SUM(order_count)::int AS total_orders
    FROM sellrocket_daily
    GROUP BY source
    ORDER BY source
  `);
  void sellrocketDaily;

  return Response.json({
    sellrocket: (srStats.rows ?? srStats) as unknown,
    runs,
  });
}
