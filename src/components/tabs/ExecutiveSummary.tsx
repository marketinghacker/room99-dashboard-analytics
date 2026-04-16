'use client';

import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import { HeroMetric } from '@/components/primitives/HeroMetric';
import { ScoreCard } from '@/components/primitives/ScoreCard';
import { ChartCard } from '@/components/primitives/ChartCard';
import { ChartArea, ChartDonut } from '@/components/primitives/charts';
import { LoadingCard, ErrorCard } from '@/components/primitives/StateCard';
import { PlatformBadge } from '@/components/primitives/PlatformBadge';
import { formatPLN, formatInt, formatPct } from '@/lib/format';

export function ExecutiveSummaryTab() {
  const { data, error, isLoading } = useFilteredSWR<any>('/api/data/executive-summary');

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
        {Array.from({ length: 6 }).map((_, i) => <LoadingCard key={i} />)}
      </div>
    );
  }
  if (error) return <ErrorCard error={String(error.message ?? error)} />;
  if (!data?.all) return <ErrorCard error="Brak danych w cache" />;

  const all = data.all;
  const kpis = all.kpis;
  const deltas = all.deltas ?? {};

  const perPlatform = data.perPlatform ?? [];
  const paidPlatforms = perPlatform.filter((p: any) => p.platform !== 'ga4' && p.payload);

  const spendByPlatform = paidPlatforms.map((p: any) => ({
    platform: p.platform,
    spend: p.payload?.kpis?.spend ?? 0,
    revenue: p.payload?.kpis?.conversionValue ?? 0,
  })).filter((p: any) => p.spend > 0)
    .sort((a: any, b: any) => b.spend - a.spend);

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      {/* Hero row — the "wow" numbers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger">
        <HeroMetric
          label="Przychód (GA4)"
          value={kpis.revenue}
          format="pln"
          delta={deltas.revenue}
          tone="primary"
        />
        <HeroMetric
          label="Wydatki marketingowe"
          value={kpis.spend}
          format="pln"
          delta={deltas.spend}
          deltaInverted
        />
        <HeroMetric
          label="COS (koszt / przychód)"
          value={kpis.cos}
          format="pct"
          delta={deltas.cos}
          deltaInverted
          sublabel={
            kpis.roas != null
              ? `ROAS: ${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(kpis.roas)}×`
              : undefined
          }
        />
      </div>

      {/* Revenue × Spend time series */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        <ChartCard
          title="Przychód vs Wydatki"
          subtitle="Dzień po dniu — GA4 revenue (niebieska) vs wszystkie reklamy (sage)"
        >
          <ChartArea
            data={all.timeSeries ?? []}
            series={[
              { key: 'revenue', label: 'Przychód (GA4)', color: 'var(--color-chart-3)' },
              { key: 'spend', label: 'Wydatki reklamowe', color: 'var(--color-chart-2)' },
            ]}
            height={280}
          />
        </ChartCard>

        <ChartCard
          title="Udział wydatków"
          subtitle="Podział budżetu między platformy"
        >
          <ChartDonut
            data={spendByPlatform.map((s: any) => ({ name: PLATFORM_NAMES[s.platform] ?? s.platform, value: s.spend }))}
            nameKey="name"
            valueKey="value"
            height={260}
          />
        </ChartCard>
      </div>

      {/* Scorecard strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        <ScoreCard label="Sesje" value={kpis.sessions} format="int" delta={deltas.sessions} />
        <ScoreCard label="Transakcje" value={kpis.transactions} format="int" delta={deltas.transactions} />
        <ScoreCard label="AOV (GA4)" value={kpis.aov} format="pln" delta={deltas.aov} hint="Średnia wartość zamówienia" />
        <ScoreCard label="Współczynnik konwersji" value={kpis.transactions && kpis.sessions ? kpis.transactions / kpis.sessions : null} format="pct" />
      </div>

      {/* Per-platform table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold">Podsumowanie wg platform</h3>
            <p className="text-[12px] text-[var(--color-ink-tertiary)] mt-0.5">Wydatki, konwersje i ROAS dla każdego kanału</p>
          </div>
        </div>
        <table className="w-full text-[13px]">
          <thead className="bg-[var(--color-bg-elevated)]">
            <tr>
              <th className="px-5 py-3 overline text-left">Platforma</th>
              <th className="px-5 py-3 overline text-right">Wydatki</th>
              <th className="px-5 py-3 overline text-right">Wyświetlenia</th>
              <th className="px-5 py-3 overline text-right">Kliki</th>
              <th className="px-5 py-3 overline text-right">Konwersje</th>
              <th className="px-5 py-3 overline text-right">Wartość konwersji</th>
              <th className="px-5 py-3 overline text-right">ROAS</th>
              <th className="px-5 py-3 overline text-right">% budżetu</th>
            </tr>
          </thead>
          <tbody>
            {paidPlatforms.map((p: any) => {
              const k = p.payload.kpis;
              const pctOfTotal = kpis.spend > 0 ? k.spend / kpis.spend : 0;
              return (
                <tr key={p.platform} className="border-b border-[var(--color-border-subtle)] last:border-b-0 hover:bg-[var(--color-bg-elevated)]/60 transition-colors">
                  <td className="px-5 py-3"><PlatformBadge platform={p.platform} /></td>
                  <td className="px-5 py-3 text-right numeric font-medium">{formatPLN(k.spend)}</td>
                  <td className="px-5 py-3 text-right numeric text-[var(--color-ink-secondary)]">{formatInt(k.impressions)}</td>
                  <td className="px-5 py-3 text-right numeric text-[var(--color-ink-secondary)]">{formatInt(k.clicks)}</td>
                  <td className="px-5 py-3 text-right numeric">{formatInt(Math.round(k.conversions))}</td>
                  <td className="px-5 py-3 text-right numeric font-medium">{formatPLN(k.conversionValue)}</td>
                  <td className="px-5 py-3 text-right numeric">{k.roas != null ? `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(k.roas)}×` : '—'}</td>
                  <td className="px-5 py-3 text-right numeric text-[var(--color-ink-secondary)]">{formatPct(pctOfTotal)}</td>
                </tr>
              );
            })}
            <tr className="bg-[var(--color-bg-elevated)] font-semibold">
              <td className="px-5 py-3 text-[12px] overline">Razem</td>
              <td className="px-5 py-3 text-right numeric">{formatPLN(kpis.spend)}</td>
              <td className="px-5 py-3 text-right numeric">{formatInt(kpis.impressions)}</td>
              <td className="px-5 py-3 text-right numeric">{formatInt(kpis.clicks)}</td>
              <td className="px-5 py-3 text-right numeric">{formatInt(Math.round(kpis.conversions))}</td>
              <td className="px-5 py-3 text-right numeric">{formatPLN(kpis.conversionValue)}</td>
              <td className="px-5 py-3 text-right numeric">{kpis.roas != null ? `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(kpis.roas)}×` : '—'}</td>
              <td className="px-5 py-3 text-right numeric">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const PLATFORM_NAMES: Record<string, string> = {
  meta: 'Meta',
  google_ads: 'Google Ads',
  pinterest: 'Pinterest',
  criteo: 'Criteo',
};
