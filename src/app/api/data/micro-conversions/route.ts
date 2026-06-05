/**
 * Mikrokonwersje — sygnały intencji (GTM-ROOM99, 13 eventów GA4).
 * Tabela z draftu: Mikrokonwersja | Etap lejka | Waga sygnału | Zdarzenia (tydz.) | Zmiana WoW.
 * Złota reguła WoW: ostatnie 7 pełnych dni vs poprzednie 7 (kotwica: wczoraj).
 */
import { jsonResponse } from '@/lib/api';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { MICRO_EVENTS } from '@/lib/sync/ga4-funnel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Etap lejka + waga sygnału — mapping z propozycji (draft, do potwierdzenia w Excelu). */
const META: Record<string, { label: string; stage: 'TOF' | 'MOF' | 'BOF'; weight: 'Wysoka' | 'Średnia' | 'Niska' }> = {
  scroll_75_product:      { label: 'Scroll ≥ 75% strony produktu',            stage: 'TOF', weight: 'Wysoka' },
  deep_engagement_120s:   { label: 'Czas wizyty ≥ 2 min (zaangażowanie)',     stage: 'TOF', weight: 'Wysoka' },
  category_depth_2plus:   { label: 'Wyświetlenie kategorii (≥ 2 podstrony)',  stage: 'TOF', weight: 'Średnia' },
  scroll_50_category:     { label: 'Scroll ≥ 50% strony kategorii',           stage: 'TOF', weight: 'Średnia' },
  page_depth_4plus:       { label: 'Głębokość wizyty ≥ 4 podstrony',          stage: 'TOF', weight: 'Średnia' },
  view_item_qualified:    { label: 'Kwalifikowane wyświetlenie produktu (15s + interakcja)', stage: 'MOF', weight: 'Wysoka' },
  product_gallery_browse: { label: 'Przeglądanie galerii zdjęć produktu',     stage: 'MOF', weight: 'Średnia' },
  related_product_click:  { label: 'Kliknięcie w produkt powiązany',          stage: 'MOF', weight: 'Średnia' },
  filter_applied:         { label: 'Użycie filtrów (rozmiar / kolor)',        stage: 'MOF', weight: 'Wysoka' },
  review_engagement:      { label: 'Wyświetlenie recenzji produktu',          stage: 'MOF', weight: 'Średnia' },
  delivery_check_click:   { label: 'Sprawdzenie dostawy',                     stage: 'BOF', weight: 'Wysoka' },
  product_inquiry_click:  { label: 'Zapytanie o produkt',                     stage: 'BOF', weight: 'Wysoka' },
  newsletter_signup:      { label: 'Zapis do newslettera',                    stage: 'TOF', weight: 'Niska' },
};

export async function GET() {
  const yesterday = new Date(Date.now() - DAY_MS);
  const last7 = { start: iso(new Date(yesterday.getTime() - 6 * DAY_MS)), end: iso(yesterday) };
  const prev7 = {
    start: iso(new Date(yesterday.getTime() - 13 * DAY_MS)),
    end: iso(new Date(yesterday.getTime() - 7 * DAY_MS)),
  };

  const agg = async (start: string, end: string) => {
    const res: any = await db.execute(sql`
      SELECT event_name AS "eventName", COALESCE(SUM(event_count), 0)::int AS events
      FROM ga4_funnel_daily
      WHERE date BETWEEN ${start} AND ${end}
      GROUP BY 1
    `);
    return new Map<string, number>(
      ((res.rows ?? res) as any[]).map((r) => [r.eventName as string, Number(r.events)]),
    );
  };

  const [cur, prev] = await Promise.all([agg(last7.start, last7.end), agg(prev7.start, prev7.end)]);

  const stageOrder = { TOF: 0, MOF: 1, BOF: 2 } as const;
  const rows = MICRO_EVENTS
    .map((ev) => {
      const m = META[ev] ?? { label: ev, stage: 'TOF' as const, weight: 'Średnia' as const };
      const events = cur.get(ev) ?? 0;
      const prevEvents = prev.get(ev) ?? 0;
      return {
        event: ev,
        label: m.label,
        stage: m.stage,
        weight: m.weight,
        eventsWeekly: events,
        wowChange: prevEvents > 0 ? (events - prevEvents) / prevEvents : null,
      };
    })
    .sort((a, b) => stageOrder[a.stage] - stageOrder[b.stage] || b.eventsWeekly - a.eventsWeekly);

  const hasData = rows.some((r) => r.eventsWeekly > 0);

  return jsonResponse({ last7, prev7, rows, hasData });
}
