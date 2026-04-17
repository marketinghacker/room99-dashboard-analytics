/**
 * POST /api/admin/reclassify-products?key=SECRET
 * Re-runs parseSkuToCategoryCollection on every row in products_daily and
 * updates category/collection in place — useful after the parser is improved,
 * so we don't have to re-fetch BaseLinker (which is slow).
 */
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { parseSkuToCategoryCollection } from '@/lib/sync/sku-parser';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  if (key !== secret) return new Response('Unauthorized', { status: 401 });

  const t0 = Date.now();

  // Pull distinct product names — parser is deterministic per name, so this
  // is the smallest unit we need to re-classify.
  const namesRes: any = await db.execute(sql`
    SELECT DISTINCT product_name FROM products_daily WHERE product_name <> ''
  `);
  const names: string[] = (namesRes.rows ?? namesRes).map((r: any) => r.product_name);

  // Build name → (category, collection) map.
  type Mapping = { category: string | null; collection: string | null };
  const map = new Map<string, Mapping>();
  for (const n of names) {
    map.set(n, parseSkuToCategoryCollection(n));
  }

  // Batch update: one UPDATE per unique mapping (much fewer than rows).
  // Group names by mapping to minimize round-trips.
  type Key = string; // `${cat ?? ''}|${col ?? ''}`
  const groups = new Map<Key, string[]>();
  for (const [name, m] of map) {
    const k: Key = `${m.category ?? ''}|${m.collection ?? ''}`;
    const arr = groups.get(k) ?? [];
    arr.push(name);
    groups.set(k, arr);
  }

  let updated = 0;
  for (const [k, nameList] of groups) {
    const [cat, col] = k.split('|');
    const category = cat === '' ? null : cat;
    const collection = col === '' ? null : col;

    // Chunk names list so IN clause stays under Postgres limit.
    const CHUNK = 500;
    for (let i = 0; i < nameList.length; i += CHUNK) {
      const slice = nameList.slice(i, i + CHUNK);
      const res: any = await db.execute(sql`
        UPDATE products_daily
        SET category = ${category}, collection = ${collection}, updated_at = now()
        WHERE product_name IN (${sql.join(slice.map((n) => sql`${n}`), sql`, `)})
          AND (COALESCE(category,'') <> COALESCE(${category}::text,'')
               OR COALESCE(collection,'') <> COALESCE(${collection}::text,''))
      `);
      updated += Number((res as any).rowCount ?? (res as any).rowsAffected ?? 0);
    }
  }

  const elapsedMs = Date.now() - t0;
  return Response.json({
    ok: true,
    namesProcessed: names.length,
    distinctMappings: groups.size,
    rowsUpdated: updated,
    elapsedMs,
  });
}

export const POST = GET;
