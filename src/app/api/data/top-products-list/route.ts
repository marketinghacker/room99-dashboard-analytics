/**
 * Tabele produktowe z draftu (Widok 3):
 *  - TOP 25 produktów wg sprzedaży (Shoper — „wiarygodne, po ID"),
 *  - TOP 5 wzrost MoM, BOTTOM 5 spadek MoM,
 * z ruchem GA4 per produkt (czy spadek sprzedaży to ruch, czy konwersja),
 * zmianą WoW (złota reguła), trendem 30 dni i miniaturą.
 *
 * Filtry (mental model klienta): kategoria + kolekcja + ROZMIAR (parsowany
 * z nazwy produktu, np. „ZASŁONA AURA 140x250").
 */
import { parseFilters, jsonResponse } from '@/lib/api';
import { resolvePeriod } from '@/lib/periods';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

const SIZE_RE = /(\d{2,3})\s*[x×]\s*(\d{2,3})/i;
function parseSize(name: string): string | null {
  const m = name.match(SIZE_RE);
  return m ? `${m[1]}x${m[2]}` : null;
}

type SkuAgg = {
  sku: string;
  name: string;
  category: string | null;
  collection: string | null;
  thumbnail: string | null;
  qty: number;
  revenue: number;
};

/** Sprzedaż Shoper per SKU w zakresie dat. */
async function skuAgg(start: string, end: string): Promise<SkuAgg[]> {
  const res: any = await db.execute(sql`
    SELECT
      sku,
      MAX(product_name) AS name,
      MAX(category) AS category,
      MAX(collection) AS collection,
      MAX(thumbnail_url) AS thumbnail,
      COALESCE(SUM(quantity), 0)::int AS qty,
      COALESCE(SUM(revenue), 0)::float AS revenue
    FROM products_daily
    WHERE source = 'shr' AND date BETWEEN ${start} AND ${end}
    GROUP BY sku
  `);
  return ((res.rows ?? res) as any[]).map((r) => ({
    sku: r.sku,
    name: r.name ?? r.sku,
    category: r.category ?? null,
    collection: r.collection ?? null,
    thumbnail: r.thumbnail ?? null,
    qty: Number(r.qty),
    revenue: Number(r.revenue),
  }));
}

/** GA4 wyświetlenia produktów per itemName (lower-case join z products_daily). */
async function ga4Views(start: string, end: string): Promise<Map<string, number>> {
  const res: any = await db.execute(sql`
    SELECT LOWER(item_name) AS name, COALESCE(SUM(items_viewed), 0)::int AS views
    FROM ga4_product_daily
    WHERE date BETWEEN ${start} AND ${end}
    GROUP BY 1
  `);
  return new Map(((res.rows ?? res) as any[]).map((r) => [r.name as string, Number(r.views)]));
}

export async function GET(req: Request) {
  const { period } = parseFilters(req);
  const url = new URL(req.url);
  const fCategory = url.searchParams.get('category');
  const fCollection = url.searchParams.get('collection');
  const fSize = url.searchParams.get('size');

  const range = resolvePeriod(period);

  // Stałe okna niezależne od filtra (złota reguła WoW + MoM dla TOP/BOTTOM).
  const yesterday = new Date(Date.now() - DAY_MS);
  const last7 = { start: iso(new Date(yesterday.getTime() - 6 * DAY_MS)), end: iso(yesterday) };
  const prev7 = { start: iso(new Date(yesterday.getTime() - 13 * DAY_MS)), end: iso(new Date(yesterday.getTime() - 7 * DAY_MS)) };
  const last30 = { start: iso(new Date(yesterday.getTime() - 29 * DAY_MS)), end: iso(yesterday) };
  const prev30 = { start: iso(new Date(yesterday.getTime() - 59 * DAY_MS)), end: iso(new Date(yesterday.getTime() - 30 * DAY_MS)) };

  const [cur, wowCur, wowPrev, momCur, momPrev, viewsCur, viewsPrev] = await Promise.all([
    skuAgg(range.start, range.end),
    skuAgg(last7.start, last7.end),
    skuAgg(prev7.start, prev7.end),
    skuAgg(last30.start, last30.end),
    skuAgg(prev30.start, prev30.end),
    ga4Views(last7.start, last7.end),
    ga4Views(prev7.start, prev7.end),
  ]);

  const bySku = (rows: SkuAgg[]) => new Map(rows.map((r) => [r.sku, r]));
  const wowCurM = bySku(wowCur);
  const wowPrevM = bySku(wowPrev);
  const momCurM = bySku(momCur);
  const momPrevM = bySku(momPrev);

  // Miniatura to cecha produktu, nie dnia — bierzemy najnowszy niepusty
  // thumbnail per SKU z CAŁEJ historii (Shoper zapisuje je nieregularnie,
  // więc okno bieżące często ich nie ma). Pokrycie ~82% SKU.
  const thumbRes: any = await db.execute(sql`
    SELECT DISTINCT ON (sku) sku, thumbnail_url
    FROM products_daily
    WHERE source = 'shr' AND thumbnail_url IS NOT NULL AND thumbnail_url <> ''
    ORDER BY sku, date DESC
  `);
  const thumbBySku = new Map<string, string>(
    ((thumbRes.rows ?? thumbRes) as any[]).map((r) => [r.sku, r.thumbnail_url]),
  );

  // Wzbogacenie + filtry (rozmiar parsowany z nazwy — w bazie go nie ma).
  let rows = cur.map((r) => {
    const size = parseSize(r.name);
    const w = wowCurM.get(r.sku);
    const wp = wowPrevM.get(r.sku);
    const m = momCurM.get(r.sku);
    const mp = momPrevM.get(r.sku);
    const nameLc = r.name.toLowerCase();
    const views = viewsCur.get(nameLc) ?? 0;
    const viewsPrevV = viewsPrev.get(nameLc) ?? 0;
    return {
      ...r,
      thumbnail: thumbBySku.get(r.sku) ?? r.thumbnail,
      size,
      wowChange: wp && wp.revenue > 0 ? ((w?.revenue ?? 0) - wp.revenue) / wp.revenue : null,
      momChange: mp && mp.revenue > 0 ? ((m?.revenue ?? 0) - mp.revenue) / mp.revenue : null,
      momRevenue: m?.revenue ?? 0,
      momPrevRevenue: mp?.revenue ?? 0,
      viewsWeekly: views,
      viewsWowChange: viewsPrevV > 0 ? (views - viewsPrevV) / viewsPrevV : null,
    };
  });

  // Listy do dropdownów filtrów — PRZED filtrowaniem, żeby user widział pełen wybór.
  const categories = Array.from(new Set(rows.map((r) => r.category).filter(Boolean))).sort() as string[];
  const collections = Array.from(
    new Set(rows.filter((r) => !fCategory || r.category === fCategory).map((r) => r.collection).filter(Boolean)),
  ).sort() as string[];
  const sizes = Array.from(
    new Set(rows.filter((r) => !fCategory || r.category === fCategory).map((r) => r.size).filter(Boolean)),
  ).sort((a, b) => (a! < b! ? -1 : 1)) as string[];

  if (fCategory) rows = rows.filter((r) => r.category === fCategory);
  if (fCollection) rows = rows.filter((r) => r.collection === fCollection);
  if (fSize) rows = rows.filter((r) => r.size === fSize);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const withShare = rows.map((r) => ({ ...r, share: totalRevenue > 0 ? r.revenue / totalRevenue : null }));

  const top25 = withShare.slice().sort((a, b) => b.revenue - a.revenue).slice(0, 25);

  // Trend 30 dni (sparkline) — tylko dla TOP 25, żeby nie mielić całej tabeli.
  const topSkus = top25.map((r) => r.sku);
  let trends = new Map<string, number[]>();
  if (topSkus.length > 0) {
    // drizzle sql`` rozwija JS-ową tablicę w krotkę ($1,$2,…) — dla ANY()
    // potrzebna jest lista IN z joinem parametrów.
    const skuList = sql.join(topSkus.map((s) => sql`${s}`), sql`, `);
    const tRes: any = await db.execute(sql`
      SELECT sku, date::text AS date, COALESCE(SUM(revenue), 0)::float AS revenue
      FROM products_daily
      WHERE source = 'shr' AND sku IN (${skuList})
        AND date BETWEEN ${last30.start} AND ${last30.end}
      GROUP BY sku, date
      ORDER BY date
    `);
    const tRows = (tRes.rows ?? tRes) as any[];
    trends = new Map(topSkus.map((s) => [s, [] as number[]]));
    const dates: string[] = [];
    for (let i = 0; i < 30; i++) dates.push(iso(new Date(yesterday.getTime() - (29 - i) * DAY_MS)));
    const byKey = new Map(tRows.map((r) => [`${r.sku}:${r.date}`, Number(r.revenue)]));
    for (const s of topSkus) trends.set(s, dates.map((d) => byKey.get(`${s}:${d}`) ?? 0));
  }
  const top25WithTrend = top25.map((r) => ({ ...r, trend30: trends.get(r.sku) ?? [] }));

  // TOP 5 wzrost / BOTTOM 5 spadek MoM — tylko produkty z sensowną bazą,
  // żeby +900% na 2 sztukach nie zaśmiecał listy.
  const MIN_MOM_BASE = 1_000; // PLN przychodu w poprzednim okresie 30d
  const momRanked = withShare.filter((r) => r.momPrevRevenue >= MIN_MOM_BASE && r.momChange != null);
  const top5Growth = momRanked.slice().sort((a, b) => (b.momChange ?? 0) - (a.momChange ?? 0)).slice(0, 5);
  const bottom5Decline = momRanked.slice().sort((a, b) => (a.momChange ?? 0) - (b.momChange ?? 0)).slice(0, 5);

  return jsonResponse({
    period,
    range,
    windows: { last7, prev7, last30, prev30 },
    filters: { categories, collections, sizes, active: { category: fCategory, collection: fCollection, size: fSize } },
    totalRevenue,
    top25: top25WithTrend,
    top5Growth,
    bottom5Decline,
    ga4Joined: viewsCur.size > 0,
  });
}
