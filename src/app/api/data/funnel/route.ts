/**
 * Lejek konwersji liczony OD UŻYTKOWNIKÓW (architektura 22.04, potwierdzone
 * z klientem): GA4 totalUsers per event, kroki:
 *   session_start → view_item → add_to_cart → begin_checkout → purchase
 *
 * Zwraca trzy widoki (odwzorowanie draftu):
 *  - steps: wszyscy użytkownicy + zmiana vs okres porównawczy,
 *  - byDevice: mobile vs desktop (konwersja do następnego etapu + różnica pp),
 *  - byUserType: nowi vs powracający (jw.).
 *
 * Źródło: ga4_funnel_daily (sync ga4_funnel). Sumowanie użytkowników po
 * dniach/segmentach = przybliżenie GA4 (GA4 deduplikuje w okresie) — spójne
 * w obrębie dashboardu, definicja widoczna w UI.
 */
import { parseFilters, jsonResponse, errorResponse } from '@/lib/api';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { resolvePeriod, resolveCompare } from '@/lib/periods';
import { FUNNEL_EVENTS } from '@/lib/sync/ga4-funnel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STEP_LABELS: Record<string, string> = {
  session_start: 'Sesje',
  view_item: 'Wyświetlenie produktu',
  add_to_cart: 'Dodanie do koszyka',
  begin_checkout: 'Rozpoczęcie zakupu',
  purchase: 'Zakup',
};

type SegmentKey = 'device' | 'user_type';

/** users per event, opcjonalnie w rozbiciu na segment (device/user_type). */
async function funnelUsers(
  start: string,
  end: string,
  segment?: SegmentKey,
): Promise<Array<{ eventName: string; segment: string; users: number }>> {
  const segCol = segment === 'device' ? sql`device` : segment === 'user_type' ? sql`user_type` : sql`'all'`;
  const res: any = await db.execute(sql`
    SELECT
      event_name AS "eventName",
      ${segCol} AS segment,
      COALESCE(SUM(users), 0)::int AS users
    FROM ga4_funnel_daily
    WHERE date BETWEEN ${start} AND ${end}
      AND event_name IN ('session_start','view_item','add_to_cart','begin_checkout','purchase')
    GROUP BY 1, 2
  `);
  return ((res.rows ?? res) as any[]).map((r) => ({
    eventName: r.eventName,
    segment: r.segment ?? 'all',
    users: Number(r.users),
  }));
}

function usersByEvent(rows: Array<{ eventName: string; segment: string; users: number }>, seg: string) {
  const m = new Map<string, number>();
  for (const r of rows) if (r.segment === seg || seg === '*') m.set(r.eventName, (m.get(r.eventName) ?? 0) + r.users);
  return m;
}

/** Kroki lejka dla jednej mapy event→users: konwersja do nast. etapu liczona od poprzedniego. */
function buildSteps(m: Map<string, number>) {
  return FUNNEL_EVENTS.map((ev, i) => {
    const users = m.get(ev) ?? 0;
    const prevUsers = i > 0 ? (m.get(FUNNEL_EVENTS[i - 1]) ?? 0) : null;
    return {
      event: ev,
      label: STEP_LABELS[ev],
      users,
      // % poprzedniego etapu — kolumna „Konwersja do następnego etapu" w drafcie
      conversionFromPrev: prevUsers != null && prevUsers > 0 ? users / prevUsers : null,
    };
  });
}

export async function GET(req: Request) {
  const { period, compare } = parseFilters(req);
  const range = resolvePeriod(period);
  const compareRange = resolveCompare(range, compare);

  const [flat, flatPrev, byDeviceRows, byUserTypeRows] = await Promise.all([
    funnelUsers(range.start, range.end),
    compareRange ? funnelUsers(compareRange.start, compareRange.end) : Promise.resolve([]),
    funnelUsers(range.start, range.end, 'device'),
    funnelUsers(range.start, range.end, 'user_type'),
  ]);

  const total = usersByEvent(flat, '*');
  if ((total.get('session_start') ?? 0) === 0) {
    return errorResponse('Brak danych lejka — uruchom sync ga4_funnel (cron lub backfill)', 503);
  }
  const totalPrev = usersByEvent(flatPrev, '*');

  const steps = buildSteps(total).map((s) => {
    const prev = totalPrev.get(s.event) ?? 0;
    return { ...s, change: prev > 0 ? (s.users - prev) / prev : null };
  });

  const mobile = buildSteps(usersByEvent(byDeviceRows, 'mobile'));
  const desktop = buildSteps(usersByEvent(byDeviceRows, 'desktop'));
  const newU = buildSteps(usersByEvent(byUserTypeRows, 'new'));
  const returning = buildSteps(usersByEvent(byUserTypeRows, 'returning'));

  const crOf = (stepsArr: ReturnType<typeof buildSteps>) => {
    const s0 = stepsArr[0]?.users ?? 0;
    const last = stepsArr[stepsArr.length - 1]?.users ?? 0;
    return s0 > 0 ? last / s0 : null;
  };

  return jsonResponse({
    period,
    compare,
    range,
    compareRange,
    steps,
    crTotal: crOf(buildSteps(total)),
    byDevice: {
      mobile: { steps: mobile, cr: crOf(mobile) },
      desktop: { steps: desktop, cr: crOf(desktop) },
    },
    byUserType: {
      new: { steps: newU, cr: crOf(newU) },
      returning: { steps: returning, cr: crOf(returning) },
    },
    definition: 'Lejek liczony od użytkowników (GA4 totalUsers per event). Konwersja = % użytkowników poprzedniego etapu.',
  });
}
