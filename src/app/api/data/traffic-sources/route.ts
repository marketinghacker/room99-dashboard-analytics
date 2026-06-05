/**
 * GA4 traffic by channelGroup + top sources.
 *
 * v2 (06.2026, draft klienta):
 *  - channelsFull: per-kanał Sesje / Dodanie do koszyka / Zakup / CR / Przychód
 *    dla WYBRANEGO okresu (CR = transakcje / użytkownicy — definicja klienta),
 *  - WoW per kanał (złota reguła: ostatnie 7 dni vs poprzednie 7, niezależnie
 *    od globalnego filtra) — Zmiana CR w pp i zmiana przychodu,
 *  - crTrends: tygodniowy współczynnik konwersji per kanał (ostatnie 12 tyg.)
 *    pod wykres liniowy trendów.
 */
import { parseFilters, getCached, jsonResponse, errorResponse } from '@/lib/api';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { resolvePeriod } from '@/lib/periods';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

type ChannelAgg = {
  channelGroup: string;
  sessions: number;
  users: number;
  addToCart: number;
  transactions: number;
  revenue: number;
};

async function channelAgg(start: string, end: string): Promise<ChannelAgg[]> {
  const res: any = await db.execute(sql`
    SELECT
      channel_group AS "channelGroup",
      COALESCE(SUM(sessions), 0)::int AS sessions,
      COALESCE(SUM(users), 0)::int AS users,
      COALESCE(SUM(add_to_cart), 0)::int AS "addToCart",
      COALESCE(SUM(transactions), 0)::int AS transactions,
      COALESCE(SUM(revenue), 0)::float AS revenue
    FROM ga4_daily
    WHERE date BETWEEN ${start} AND ${end}
    GROUP BY channel_group
    ORDER BY sessions DESC
  `);
  return ((res.rows ?? res) as any[]).map((r) => ({
    channelGroup: r.channelGroup ?? 'Unassigned',
    sessions: Number(r.sessions),
    users: Number(r.users),
    addToCart: Number(r.addToCart),
    transactions: Number(r.transactions),
    revenue: Number(r.revenue),
  }));
}

export async function GET(req: Request) {
  const { period, compare } = parseFilters(req);
  const payload = await getCached('ga4', period, compare);
  if (!payload) return errorResponse('No cache', 503);

  const range = resolvePeriod(period);

  // Pełne agregaty per kanał dla wybranego okresu.
  const channelsFull = await channelAgg(range.start, range.end);

  // Złota reguła WoW: ostatnie 7 pełnych dni vs poprzednie 7 (kotwica: wczoraj).
  const yesterday = new Date(Date.now() - DAY_MS);
  const last7 = { start: iso(new Date(yesterday.getTime() - 6 * DAY_MS)), end: iso(yesterday) };
  const prev7 = {
    start: iso(new Date(yesterday.getTime() - 13 * DAY_MS)),
    end: iso(new Date(yesterday.getTime() - 7 * DAY_MS)),
  };
  const [wowCur, wowPrev] = await Promise.all([
    channelAgg(last7.start, last7.end),
    channelAgg(prev7.start, prev7.end),
  ]);
  const prevByChannel = new Map(wowPrev.map((c) => [c.channelGroup, c]));
  const wow = wowCur.map((c) => {
    const p = prevByChannel.get(c.channelGroup);
    const cr = c.users > 0 ? c.transactions / c.users : null;
    const crPrev = p && p.users > 0 ? p.transactions / p.users : null;
    return {
      channelGroup: c.channelGroup,
      // Zmiana CR w punktach procentowych (pp) — tak czyta to klient.
      crDeltaPp: cr != null && crPrev != null ? (cr - crPrev) * 100 : null,
      revenueDelta: p && p.revenue > 0 ? (c.revenue - p.revenue) / p.revenue : null,
      sessionsDelta: p && p.sessions > 0 ? (c.sessions - p.sessions) / p.sessions : null,
    };
  });

  // Tygodniowe trendy CR per kanał — ostatnie 12 pełnych tygodni ISO.
  const trendsRes: any = await db.execute(sql`
    SELECT
      to_char(date_trunc('week', date), 'YYYY-MM-DD') AS week,
      channel_group AS "channelGroup",
      COALESCE(SUM(transactions), 0)::int AS transactions,
      COALESCE(SUM(users), 0)::int AS users
    FROM ga4_daily
    WHERE date >= ${iso(new Date(yesterday.getTime() - 12 * 7 * DAY_MS))}
      AND date <= ${iso(yesterday)}
    GROUP BY 1, 2
    ORDER BY 1
  `);
  const trendRows = ((trendsRes.rows ?? trendsRes) as any[]).map((r) => ({
    week: r.week as string,
    channelGroup: (r.channelGroup ?? 'Unassigned') as string,
    cr: Number(r.users) > 0 ? Number(r.transactions) / Number(r.users) : null,
  }));

  return jsonResponse({
    period,
    compare,
    kpis: payload.kpis,
    compareKpis: payload.compareKpis,
    channels: payload.channelBreakdown,
    channelsFull,
    wow: { last7, prev7, rows: wow },
    crTrends: trendRows,
    timeSeries: payload.timeSeries,
  });
}
