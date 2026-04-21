'use client';

import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import { HeroKpi, StatCard, SectionHead, Overline } from '@/components/primitives/editorial';
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
    <div className="flex flex-col gap-10">
      <header>
        <div className="overline mb-2">Ruch · GA4 acquisition</div>
        <h1 className="section-title" style={{ fontSize: 32, letterSpacing: '-0.02em', fontWeight: 500 }}>
          Źródła ruchu
        </h1>
        <p className="lede mt-2" style={{ fontSize: 14 }}>
          Źródło: Google Analytics 4 · kanały pozyskiwania, sesje, przychód transakcyjny.
          Przychód GA4 może różnić się od Shoper (attribution window, refunds).
        </p>
      </header>

      <div className="grid gap-5" style={{ gridTemplateColumns: '1.25fr 1fr 1fr' }}>
        <HeroKpi
          label="Sesje"
          value={k.sessions ?? 0}
          format="int"
          primary
          hint="Źródło: GA4"
        />
        <HeroKpi
          label="Użytkownicy"
          value={k.users ?? 0}
          format="int"
          hint={k.newUsers && k.users ? `${formatPct(k.newUsers / k.users)} nowi` : 'Źródło: GA4'}
        />
        <HeroKpi
          label="Przychód (GA4)"
          value={totalRevenue}
          format="pln"
          hint="Suma po wszystkich channel groups"
        />
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard label="Nowi użytkownicy" value={k.newUsers ?? 0} format="int" />
        <StatCard label="Engaged sessions" value={k.engagedSessions ?? 0} format="int" />
        <StatCard label="Transakcje" value={k.transactions ?? 0} format="int" />
        <StatCard label="Bounce rate" value={(k.bounceRate ?? 0) * 100} format="pct" />
      </div>

      <section>
        <SectionHead
          number="§01"
          title="Sesje vs przychód wg kanału"
          sub="Źródło: GA4 · default channel grouping"
        />
        <div className="grid gap-5" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
          <div className="card p-5">
            <Overline>Sesje wg kanału</Overline>
            <div className="mt-3">
              <ChartBar
                data={channels.map((c: any) => ({ name: c.channelGroup, sessions: c.sessions }))}
                xKey="name"
                yKey="sessions"
                label="Sesje"
                horizontal
                height={Math.max(240, channels.length * 32 + 40)}
              />
            </div>
          </div>
          <div className="card p-5">
            <Overline>Przychód wg kanału</Overline>
            <div className="mt-3">
              <ChartDonut
                data={channels.filter((c: any) => c.revenue > 0).map((c: any) => ({ name: c.channelGroup, value: c.revenue }))}
                nameKey="name"
                valueKey="value"
                height={280}
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHead
          number="§02"
          title="Kanały — pełne zestawienie"
          sub="Źródło: GA4 · sessions / users / transactions / revenue / CR"
        />
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-line-soft)' }}>
                <th className="table-header text-left px-4 py-3">Kanał</th>
                <th className="table-header text-right px-4 py-3">Sesje</th>
                <th className="table-header text-right px-4 py-3">Użytkownicy</th>
                <th className="table-header text-right px-4 py-3">Transakcje</th>
                <th className="table-header text-right px-4 py-3">Przychód (GA4)</th>
                <th className="table-header text-right px-4 py-3">CR</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c: any) => (
                <tr
                  key={c.channelGroup}
                  style={{ borderBottom: '1px solid var(--color-line-soft)' }}
                  className="transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-4 py-3 table-cell font-medium">{c.channelGroup}</td>
                  <td className="px-4 py-3 text-right numeric table-cell">{formatInt(c.sessions)}</td>
                  <td className="px-4 py-3 text-right numeric table-cell">{formatInt(c.users)}</td>
                  <td className="px-4 py-3 text-right numeric table-cell">{formatInt(c.transactions)}</td>
                  <td className="px-4 py-3 text-right numeric table-cell">{formatPLN(c.revenue)}</td>
                  <td className="px-4 py-3 text-right numeric table-cell">
                    {c.sessions > 0 ? formatPct(c.transactions / c.sessions) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
