/**
 * GET /api/admin/products-peek?key=SECRET
 * Debug: samples top-revenue SKUs with parsed category/collection split,
 * so we can tune the sku-parser regex against real data.
 */
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  if (key !== secret) return new Response('Unauthorized', { status: 401 });

  const limit = Number(url.searchParams.get('limit') ?? 40);
  const onlyUncategorized = url.searchParams.get('uncategorized') === '1';

  const catCond = onlyUncategorized ? sql`AND category IS NULL` : sql``;

  const res: any = await db.execute(sql`
    SELECT
      sku,
      MAX(product_name) AS product_name,
      category,
      collection,
      SUM(revenue)::float AS revenue,
      SUM(quantity)::int AS qty
    FROM products_daily
    WHERE date >= CURRENT_DATE - INTERVAL '45 days'
      ${catCond}
    GROUP BY sku, category, collection
    ORDER BY revenue DESC
    LIMIT ${limit}
  `);

  const totals: any = await db.execute(sql`
    SELECT
      SUM(revenue) FILTER (WHERE category IS NOT NULL)::float AS cat_rev,
      SUM(revenue) FILTER (WHERE category IS NULL)::float AS uncat_rev,
      SUM(revenue)::float AS total_rev,
      COUNT(DISTINCT sku) FILTER (WHERE category IS NOT NULL)::int AS cat_skus,
      COUNT(DISTINCT sku) FILTER (WHERE category IS NULL)::int AS uncat_skus
    FROM products_daily
    WHERE date >= CURRENT_DATE - INTERVAL '45 days'
  `);

  return Response.json({
    totals: (totals.rows ?? totals)[0],
    samples: res.rows ?? res,
  });
}
