'use client';

import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import { HeroMetric } from '@/components/primitives/HeroMetric';
import { ScoreCard } from '@/components/primitives/ScoreCard';
import { ChartCard } from '@/components/primitives/ChartCard';
import { ChartBar, ChartDonut } from '@/components/primitives/charts';
import { LoadingCard, ErrorCard } from '@/components/primitives/StateCard';
import { formatPLN, formatInt, formatPct } from '@/lib/format';

export function TrafficSourcesTab() {
  const { data, error, isLoading } = useFilteredSWR<any>('/api/data/traffic-sources');

  if (isLoading) return <LoadingCard />;
  if (error) return <ErrorCard error={String(error.message ?? error)} />;
  if (!data?.channels) return <ErrorCard error="Brak danych GA4" />;

  const channels = (data.channels ?? []).sort((a: any, b: any) => b.sessions - a.sessions);
  const k = data.kpis;
  const totalRevenue = channels.reduce((s: number, c: any) => s + c.revenue, 0);

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      <div>
        <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Źródła ruchu</h2>
        <p className="text-[13px] text-[var(--color-ink-tertiary)] mt-0.5">
          GA4 kanały — sesje, użytkownicy, konwersje
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger">
        <HeroMetric label="Sesje" value={k.sessions} format="int" />
        <HeroMetric label="Użytkownicy" value={k.users} format="int" />
        <HeroMetric label="Przychód" value={totalRevenue} format="pln" tone="primary" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard label="Nowi użytkownicy" value={k.newUsers} format="int" hint={k.users ? `${formatPct(k.newUsers / k.users)} udział` : undefined} />
        <ScoreCard label="Engaged sessions" value={k.engagedSessions} format="int" hint={k.sessions ? formatPct(k.engagedSessions / k.sessions) : undefined} />
        <ScoreCard label="Transakcje" value={k.transactions} format="int" />
        <ScoreCard label="Bounce rate" value={k.bounceRate} format="pct" deltaInverted />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5">
        <ChartCard title="Sesje wg kanału" subtitle="Porównanie wolumenu ruchu">
          <ChartBar
            data={channels.map((c: any) => ({ name: c.channelGroup, sessions: c.sessions }))}
            xKey="name"
            yKey="sessions"
            label="Sesje"
            horizontal
            height={Math.max(240, channels.length * 32 + 40)}
          />
        </ChartCard>
        <ChartCard title="Przychód wg kanału" subtitle="Udział w sprzedaży">
          <ChartDonut
            data={channels.filter((c: any) => c.revenue > 0).map((c: any) => ({ name: c.channelGroup, value: c.revenue }))}
            nameKey="name"
            valueKey="value"
            height={280}
          />
        </ChartCard>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-[var(--color-bg-elevated)] border-b border-[var(--color-border-subtle)]">
            <tr>
              <th className="px-5 py-3 overline text-left">Kanał</th>
              <th className="px-5 py-3 overline text-right">Sesje</th>
              <th className="px-5 py-3 overline text-right">Użytkownicy</th>
              <th className="px-5 py-3 overline text-right">Transakcje</th>
              <th className="px-5 py-3 overline text-right">Przychód</th>
              <th className="px-5 py-3 overline text-right">Konwersja</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c: any) => (
              <tr key={c.channelGroup} className="border-b border-[var(--color-border-subtle)] last:border-b-0 hover:bg-[var(--color-bg-elevated)]/60 transition-colors">
                <td className="px-5 py-3 font-medium">{c.channelGroup}</td>
                <td className="px-5 py-3 text-right numeric">{formatInt(c.sessions)}</td>
                <td className="px-5 py-3 text-right numeric">{formatInt(c.users)}</td>
                <td className="px-5 py-3 text-right numeric">{formatInt(c.transactions)}</td>
                <td className="px-5 py-3 text-right numeric font-medium">{formatPLN(c.revenue)}</td>
                <td className="px-5 py-3 text-right numeric text-[var(--color-ink-secondary)]">
                  {c.sessions > 0 ? formatPct(c.transactions / c.sessions) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
