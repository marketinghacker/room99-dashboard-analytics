/**
 * Per-category / per-collection / per-sku sales analytics.
 *
 * Source: products_daily (BaseLinker direct), aggregated server-side.
 * For each row we fetch the same range one year earlier (YoY) and emit
 * alerts: "Spadek YoY > 20/50%", "Allegro wyprzedza Shoper", "Przeoptymalizowane",
 * "Breakout +300% YoY".
 *
 * Query param `level` ∈ {'category' | 'collection' | 'sku'} (default 'category').
 * Query param `category` filters to one category (use when drilling down to collections / skus).
 */
import { parseFilters, jsonResponse } from '@/lib/api';
import { resolvePeriod } from '@/lib/periods';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Level = 'category' | 'collection' | 'sku';
type AggRow = {
  group: string;
  shr_revenue: number; allegro_revenue: number;
  shr_qty: number; allegro_qty: number;
};

async function aggregate(level: Level, range: { start: string; end: string }, categoryFilter?: string | null): Promise<AggRow[]> {
  const groupCol =
    level === 'category' ? sql`category` :
    level === 'collection' ? sql`collection` :
    sql`sku`;

  // For collection/sku drill-down we usually scope to one category.
  const catWhere = categoryFilter ? sql`AND category = ${categoryFilter}` : sql``;

  const res: any = await db.execute(sql`
    SELECT
      ${groupCol} AS "group",
      SUM(CASE WHEN source='shr' THEN revenue ELSE 0 END)::float AS shr_revenue,
      SUM(CASE WHEN source='allegro' THEN revenue ELSE 0 END)::float AS allegro_revenue,
      SUM(CASE WHEN source='shr' THEN quantity ELSE 0 END)::int AS shr_qty,
      SUM(CASE WHEN source='allegro' THEN quantity ELSE 0 END)::int AS allegro_qty
    FROM products_daily
    WHERE date BETWEEN ${range.start} AND ${range.end}
      AND ${groupCol} IS NOT NULL
      ${catWhere}
    GROUP BY ${groupCol}
    ORDER BY (
      SUM(CASE WHEN source='shr' THEN revenue ELSE 0 END)
      + SUM(CASE WHEN source='allegro' THEN revenue ELSE 0 END)
    ) DESC
    LIMIT 500
  `);
  return (res.rows ?? res) as AggRow[];
}

function shiftYear(iso: string, years: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const { period, compare } = parseFilters(req);
  const url = new URL(req.url);
  const level = ((url.searchParams.get('level') as Level | null) ?? 'category');
  const categoryFilter = url.searchParams.get('category');

  const range = resolvePeriod(period);
  const yoyRange = { start: shiftYear(range.start, -1), end: shiftYear(range.end, -1) };

  const [current, yoy] = await Promise.all([
    aggregate(level, range, categoryFilter),
    aggregate(level, yoyRange, categoryFilter),
  ]);
  const yoyByGroup = new Map(yoy.map((r) => [r.group, r]));

  const enriched = current.map((r) => {
    const total = r.shr_revenue + r.allegro_revenue;
    const y = yoyByGroup.get(r.group);
    const yoyShr = y?.shr_revenue ?? 0;
    const yoyAllegro = y?.allegro_revenue ?? 0;
    const yoyTotal = y ? yoyShr + yoyAllegro : null;
    const yoyDelta = yoyTotal && yoyTotal > 0 ? (total - yoyTotal) / yoyTotal : null;
    const yoyShrDelta = yoyShr > 0 ? (r.shr_revenue - yoyShr) / yoyShr : null;
    const yoyAllegroDelta = yoyAllegro > 0 ? (r.allegro_revenue - yoyAllegro) / yoyAllegro : null;
    // Channel share this period vs last period — tells the story "kategoria
    // przesuwa się z Shopera na Allegro" even when total is flat.
    const shrShare = total > 0 ? r.shr_revenue / total : null;
    const yoyShrShare = yoyTotal && yoyTotal > 0 ? yoyShr / yoyTotal : null;
    const shrShareDelta = shrShare != null && yoyShrShare != null ? shrShare - yoyShrShare : null;

    const alerts: string[] = [];
    if (yoyDelta != null && yoyDelta < -0.5) alerts.push('Spadek YoY > 50%');
    else if (yoyDelta != null && yoyDelta < -0.2) alerts.push('Spadek YoY > 20%');
    if (r.allegro_revenue > r.shr_revenue && r.shr_revenue > 0) alerts.push('Allegro wyprzedza Shoper');
    if (y && (y.shr_qty + y.allegro_qty) > 100 && (r.shr_qty + r.allegro_qty) < 10) {
      alerts.push('Przeoptymalizowane (sprzedawano rok temu, teraz cisza)');
    }
    if (yoyDelta != null && yoyDelta > 3) alerts.push('Breakout +300% YoY');
    if (shrShareDelta != null && shrShareDelta < -0.1) alerts.push('Migracja SHR → Allegro');
    else if (shrShareDelta != null && shrShareDelta > 0.1) alerts.push('Powrót na Shoper');

    return {
      group: r.group,
      shrRevenue: r.shr_revenue,
      allegroRevenue: r.allegro_revenue,
      shrQty: r.shr_qty,
      allegroQty: r.allegro_qty,
      total,
      // YoY channel split
      yoyShrRevenue: yoyShr,
      yoyAllegroRevenue: yoyAllegro,
      yoyTotal,
      yoyDelta,
      yoyShrDelta,
      yoyAllegroDelta,
      // Channel share evolution
      shrShare,           // e.g. 0.52 = 52% z kategorii zrobił Shoper
      yoyShrShare,
      shrShareDelta,      // e.g. -0.08 = udział SHR spadł o 8pp
      alerts,
    };
  });

  return jsonResponse({
    period,
    compare,
    level,
    range,
    yoyRange,
    summary: {
      groups: enriched.length,
      totalRevenue: enriched.reduce((s, r) => s + r.total, 0),
      totalShrRevenue: enriched.reduce((s, r) => s + r.shrRevenue, 0),
      totalAllegroRevenue: enriched.reduce((s, r) => s + r.allegroRevenue, 0),
    },
    items: enriched,
    alerts: enriched.filter((x) => x.alerts.length),
  });
}
