'use client';

import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import {
  HeroKpi, StatCard, SectionHead, CompareBar, Overline,
} from '@/components/primitives/editorial';
import { ChartLine } from '@/components/primitives/charts';
import { LoadingCard, ErrorCard } from '@/components/primitives/StateCard';
import { formatPLN, formatInt, formatPct } from '@/lib/format';

export function SalesChannelsTab() {
  const { data, error, isLoading } = useFilteredSWR<any>('/api/data/sales-channels');

  if (isLoading) return <LoadingCard />;
  if (error) return <ErrorCard error={String(error.message ?? error)} />;
  if (!data?.salesBySource) return <ErrorCard error="Brak danych SellRocket" />;

  const sbs = data.salesBySource as {
    shr: { revenue: number; orders: number; aov: number | null };
    allegro: { revenue: number; orders: number; aov: number | null };
    other: { revenue: number; orders: number; aov: number | null };
    all: { revenue: number; orders: number; aov: number | null };
  };
  const timeSeries = (data.timeSeries ?? []) as Array<{
    date: string; revenueShr: number; revenueAllegro: number; revenueOther: number;
  }>;

  const totalTracked = sbs.shr.revenue + sbs.allegro.revenue;
  const shrShare = totalTracked > 0 ? sbs.shr.revenue / totalTracked : 0;
  const allegroShare = totalTracked > 0 ? sbs.allegro.revenue / totalTracked : 0;

  const daysAllegroWins = timeSeries.filter((t) => t.revenueAllegro > t.revenueShr).length;
  const totalDays = timeSeries.filter((t) => t.revenueShr > 0 || t.revenueAllegro > 0).length;
  const alertDays = timeSeries.filter((t) => t.revenueAllegro > t.revenueShr);

  return (
    <div className="flex flex-col gap-10">
      <header>
        <div className="overline mb-2">Sprzedaż · kanały</div>
        <h1 className="section-title" style={{ fontSize: 32, letterSpacing: '-0.02em', fontWeight: 500 }}>
          Shoper vs Allegro
        </h1>
        <p className="lede mt-2" style={{ fontSize: 14 }}>
          Źródło: SellRocket (BaseLinker direct) · Shoper = sklep własny Room99.pl (zakres agencji) ·
          Allegro = marketplace. Klient powinien mieć przewagę Shoper &gt; Allegro każdego dnia.
        </p>
      </header>

      {/* Hero: Compare bar */}
      <CompareBar
        leftLabel="Shoper (Room99.pl)"
        leftValue={sbs.shr.revenue}
        rightLabel="Allegro"
        rightValue={sbs.allegro.revenue}
        format="pln"
      />

      {/* Context KPIs */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard label="Zamówienia — Shoper" value={sbs.shr.orders ?? 0} format="int" />
        <StatCard label="AOV — Shoper" value={sbs.shr.aov ?? 0} format="pln" />
        <StatCard label="Zamówienia — Allegro" value={sbs.allegro.orders ?? 0} format="int" />
        <StatCard label="AOV — Allegro" value={sbs.allegro.aov ?? 0} format="pln" />
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <HeroKpi
          label="Udział Shoper (Room99.pl)"
          value={shrShare * 100}
          format="pct"
          primary
          hint={`${formatPLN(sbs.shr.revenue)} / ${formatPLN(totalTracked)} razem`}
        />
        <HeroKpi
          label="Udział Allegro"
          value={allegroShare * 100}
          format="pct"
          hint={`${formatPLN(sbs.allegro.revenue)} / ${formatPLN(totalTracked)} razem`}
        />
      </div>

      {/* §01 daily */}
      <section>
        <SectionHead
          number="§01"
          title="Shoper vs Allegro — dzień po dniu"
          sub="Źródło: SellRocket · klient-facing: sklep własny powinien prowadzić każdego dnia"
          right={
            daysAllegroWins === 0 ? (
              <span className="chip chip-pos">✓ Shoper prowadzi przez wszystkie {totalDays} dni</span>
            ) : (
              <span className="chip chip-neg">⚠ Allegro przewyższa Shoper w {daysAllegroWins}/{totalDays} dni</span>
            )
          }
        />
        <div className="card p-5">
          <ChartLine
            data={timeSeries}
            series={[
              { key: 'revenueShr', label: 'Shoper', color: 'var(--color-accent)' },
              { key: 'revenueAllegro', label: 'Allegro', color: 'var(--color-accent-2)' },
            ]}
            height={300}
          />
        </div>
      </section>

      {/* Alert days */}
      {alertDays.length > 0 && (
        <section className="card p-5" style={{
          background: 'var(--color-accent-negative-bg)',
          border: '1px solid color-mix(in oklch, var(--color-accent-negative) 30%, transparent)',
        }}>
          <div className="flex items-start gap-3">
            <div className="w-1 min-h-[48px] rounded-full" style={{ background: 'var(--color-accent-negative)' }} />
            <div className="flex-1">
              <Overline>⚠ Alert</Overline>
              <div className="text-[14px] mt-1" style={{ color: 'var(--color-ink-primary)', fontWeight: 500 }}>
                {alertDays.length} {alertDays.length === 1 ? 'dzień' : 'dni'} gdy Allegro &gt; Shoper
              </div>
              <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                {alertDays.map((d) => (
                  <div key={d.date} className="text-[12px] numeric flex items-baseline gap-2">
                    <span className="font-mono text-[11px]" style={{ color: 'var(--color-ink-tertiary)' }}>{d.date}</span>
                    <span style={{ color: 'var(--color-accent-negative)', fontWeight: 600 }}>
                      +{formatPLN(d.revenueAllegro - d.revenueShr)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[11px]" style={{ color: 'var(--color-ink-tertiary)' }}>
                Sprawdź co napędzało sprzedaż Allegro — rozważ retargeting Meta/SEM dla Shopera.
              </div>
            </div>
          </div>
        </section>
      )}

      {/* §02 full table */}
      <section>
        <SectionHead
          number="§02"
          title="Kanały — pełne zestawienie"
          sub="Źródło: SellRocket (BaseLinker direct). Ignorujemy pozostałe marketplaces."
        />
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-line-soft)' }}>
                <th className="table-header text-left px-4 py-3">Kanał</th>
                <th className="table-header text-right px-4 py-3">Przychód</th>
                <th className="table-header text-right px-4 py-3">Zamówienia</th>
                <th className="table-header text-right px-4 py-3">AOV</th>
                <th className="table-header text-right px-4 py-3">Udział</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--color-line-soft)' }}>
                <td className="px-4 py-3 table-cell">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent)' }} />
                    <span className="font-medium">Shoper (Room99.pl)</span>
                    <span className="chip chip-pos text-[10px] py-0 px-1.5">zakres agencji</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right numeric font-medium table-cell">{formatPLN(sbs.shr.revenue)}</td>
                <td className="px-4 py-3 text-right numeric table-cell">{formatInt(sbs.shr.orders)}</td>
                <td className="px-4 py-3 text-right numeric table-cell">{formatPLN(sbs.shr.aov)}</td>
                <td className="px-4 py-3 text-right numeric table-cell">{formatPct(shrShare)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--color-line-soft)' }}>
                <td className="px-4 py-3 table-cell">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent-2)' }} />
                    <span className="font-medium">Allegro</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right numeric font-medium table-cell">{formatPLN(sbs.allegro.revenue)}</td>
                <td className="px-4 py-3 text-right numeric table-cell">{formatInt(sbs.allegro.orders)}</td>
                <td className="px-4 py-3 text-right numeric table-cell">{formatPLN(sbs.allegro.aov)}</td>
                <td className="px-4 py-3 text-right numeric table-cell">{formatPct(allegroShare)}</td>
              </tr>
              <tr style={{ background: 'var(--color-bg-elevated)' }}>
                <td className="px-4 py-3 overline">Razem (Shoper + Allegro)</td>
                <td className="px-4 py-3 text-right numeric font-medium">{formatPLN(totalTracked)}</td>
                <td className="px-4 py-3 text-right numeric font-medium">{formatInt(sbs.shr.orders + sbs.allegro.orders)}</td>
                <td className="px-4 py-3 text-right numeric font-medium">
                  {formatPLN(
                    sbs.shr.orders + sbs.allegro.orders > 0
                      ? totalTracked / (sbs.shr.orders + sbs.allegro.orders)
                      : null
                  )}
                </td>
                <td className="px-4 py-3 text-right numeric font-medium">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
