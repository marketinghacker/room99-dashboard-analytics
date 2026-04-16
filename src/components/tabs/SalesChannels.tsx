'use client';

import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import { HeroMetric } from '@/components/primitives/HeroMetric';
import { ScoreCard } from '@/components/primitives/ScoreCard';
import { ChartCard } from '@/components/primitives/ChartCard';
import { ChartLine } from '@/components/primitives/charts';
import { LoadingCard, ErrorCard } from '@/components/primitives/StateCard';
import { formatPLN, formatInt, formatPct } from '@/lib/format';
import { cn } from '@/components/ui/cn';

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

  // Ignore other marketplaces — per Marcin's spec the dashboard only
  // contrasts Shoper (agency scope) vs Allegro (benchmark).
  const totalTracked = sbs.shr.revenue + sbs.allegro.revenue;
  const shrShare = totalTracked > 0 ? sbs.shr.revenue / totalTracked : 0;
  const allegroShare = totalTracked > 0 ? sbs.allegro.revenue / totalTracked : 0;

  const channelRows = [
    { key: 'shr', label: 'Shoper (Room99.pl)', ...sbs.shr, share: shrShare, color: 'var(--color-chart-3)', agency: true },
    { key: 'allegro', label: 'Allegro', ...sbs.allegro, share: allegroShare, color: 'var(--color-chart-4)', agency: false },
  ];

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      <div>
        <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Kanały sprzedaży</h2>
        <p className="text-[13px] text-[var(--color-ink-tertiary)] mt-0.5">
          Podział sprzedaży między Shoper (sklep własny — zakres agencji), Allegro i pozostałe kanały.
          Źródło: SellRocket / BaseLinker.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger">
        <HeroMetric
          label="Shoper (Room99.pl)"
          value={sbs.shr.revenue}
          format="pln"
          tone="primary"
          sublabel={`${formatPct(shrShare)} całej sprzedaży · ${formatInt(sbs.shr.orders)} zamówień`}
        />
        <HeroMetric
          label="Allegro"
          value={sbs.allegro.revenue}
          format="pln"
          sublabel={`${formatPct(allegroShare)} sprzedaży · ${formatInt(sbs.allegro.orders)} zamówień`}
        />
        <HeroMetric
          label="Stosunek Shoper vs Allegro"
          value={sbs.allegro.revenue > 0 ? sbs.shr.revenue / sbs.allegro.revenue : null}
          format="decimal"
          sublabel="Ile razy Shoper > Allegro"
        />
      </div>

      {/* Share bar — proportions visually */}
      <div className="card p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-[15px] font-semibold">Proporcja przychodu wg kanału</h3>
          <span className="text-[12px] text-[var(--color-ink-tertiary)] numeric">
            Razem: {formatPLN(sbs.all.revenue)}
          </span>
        </div>
        <div className="flex h-10 w-full rounded-[10px] overflow-hidden border border-[var(--color-border-subtle)]">
          {channelRows.map((c) => (
            <div
              key={c.key}
              style={{
                width: `${Math.max(0.5, c.share * 100)}%`,
                background: c.color,
              }}
              className="relative flex items-center justify-center text-[11px] font-semibold text-white transition-all duration-500"
              title={`${c.label}: ${formatPLN(c.revenue)} (${formatPct(c.share)})`}
            >
              {c.share > 0.05 && formatPct(c.share)}
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          {channelRows.map((c) => (
            <div key={c.key} className="flex items-center gap-2 text-[12px]">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c.color }} />
              <span className="text-[var(--color-ink-secondary)]">{c.label}</span>
              {c.agency && (
                <span className="chip text-[10px] py-0 px-1.5 bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] border-[var(--color-accent-primary)]/20">
                  zakres agencji
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <ChartCard title="Przychód dzień po dniu" subtitle="Shoper vs Allegro vs pozostałe">
        <ChartLine
          data={timeSeries}
          series={[
            { key: 'revenueShr', label: 'Shoper', color: 'var(--color-chart-3)' },
            { key: 'revenueAllegro', label: 'Allegro', color: 'var(--color-chart-4)' },
            { key: 'revenueOther', label: 'Pozostałe', color: 'var(--color-chart-1)' },
          ]}
          height={300}
        />
      </ChartCard>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard label="AOV — Shoper" value={sbs.shr.aov} format="pln" hint="Średnie zamówienie na sklepie" />
        <ScoreCard label="AOV — Allegro" value={sbs.allegro.aov} format="pln" />
        <ScoreCard label="AOV — Pozostałe" value={sbs.other.aov} format="pln" />
        <ScoreCard label="AOV — Łącznie" value={sbs.all.aov} format="pln" />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-[var(--color-bg-elevated)] border-b border-[var(--color-border-subtle)]">
            <tr>
              <th className="px-5 py-3 overline text-left">Kanał</th>
              <th className="px-5 py-3 overline text-right">Przychód</th>
              <th className="px-5 py-3 overline text-right">Zamówienia</th>
              <th className="px-5 py-3 overline text-right">AOV</th>
              <th className="px-5 py-3 overline text-right">Udział</th>
            </tr>
          </thead>
          <tbody>
            {channelRows.map((c) => (
              <tr key={c.key} className={cn(
                'border-b border-[var(--color-border-subtle)] last:border-b-0 hover:bg-[var(--color-bg-elevated)]/60 transition-colors',
                c.agency && 'bg-[var(--color-accent-primary)]/5'
              )}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                    <span className="font-medium">{c.label}</span>
                    {c.agency && (
                      <span className="chip text-[10px] py-0 px-1.5 bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] border-[var(--color-accent-primary)]/20">
                        agencja
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 text-right numeric font-medium">{formatPLN(c.revenue)}</td>
                <td className="px-5 py-3 text-right numeric">{formatInt(c.orders)}</td>
                <td className="px-5 py-3 text-right numeric text-[var(--color-ink-secondary)]">{formatPLN(c.aov)}</td>
                <td className="px-5 py-3 text-right numeric">{formatPct(c.share)}</td>
              </tr>
            ))}
            <tr className="bg-[var(--color-bg-elevated)] font-semibold">
              <td className="px-5 py-3 overline text-[12px]">Razem</td>
              <td className="px-5 py-3 text-right numeric">{formatPLN(sbs.all.revenue)}</td>
              <td className="px-5 py-3 text-right numeric">{formatInt(sbs.all.orders)}</td>
              <td className="px-5 py-3 text-right numeric">{formatPLN(sbs.all.aov)}</td>
              <td className="px-5 py-3 text-right numeric">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
