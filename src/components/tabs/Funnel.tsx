'use client';

import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import { HeroMetric } from '@/components/primitives/HeroMetric';
import { ScoreCard } from '@/components/primitives/ScoreCard';
import { ChartCard } from '@/components/primitives/ChartCard';
import { LoadingCard, ErrorCard } from '@/components/primitives/StateCard';
import { formatInt, formatPct } from '@/lib/format';

export function FunnelTab() {
  const { data, error, isLoading } = useFilteredSWR<any>('/api/data/funnel');

  if (isLoading) return <LoadingCard />;
  if (error) return <ErrorCard error={String(error.message ?? error)} />;
  if (!data?.steps) return <ErrorCard error="Brak danych lejka" />;

  const steps: Array<{ name: string; value: number; dropoff: number | null; conversion: number | null }> = data.steps;
  const maxValue = Math.max(...steps.map((s) => s.value), 1);
  const k = data.kpis;

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      <div>
        <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Lejek konwersji</h2>
        <p className="text-[13px] text-[var(--color-ink-tertiary)] mt-0.5">
          GA4 ecommerce — od sesji do transakcji, drop-off na każdym kroku
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HeroMetric label="Wejść w lejek" value={k.sessions} format="int" />
        <HeroMetric label="Transakcje" value={k.transactions} format="int" tone="primary" />
        <HeroMetric
          label="Konwersja end-to-end"
          value={k.sessions > 0 ? k.transactions / k.sessions : null}
          format="pct"
        />
      </div>

      {/* Funnel visualization — shrinking bars */}
      <div className="card p-6">
        <h3 className="text-[15px] font-semibold mb-1">Etapy lejka</h3>
        <p className="text-[12px] text-[var(--color-ink-tertiary)] mb-5">Liczby bezwzględne + drop-off między krokami</p>
        <div className="flex flex-col gap-3">
          {steps.map((s, i) => {
            const widthPct = (s.value / maxValue) * 100;
            const isLast = i === steps.length - 1;
            return (
              <div key={s.name} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-medium">{s.name}</span>
                  <div className="flex items-baseline gap-3">
                    <span className="numeric text-[15px] font-semibold">{formatInt(s.value)}</span>
                    {s.conversion != null && (
                      <span className="numeric text-[11px] text-[var(--color-ink-tertiary)]">
                        {formatPct(s.conversion)} sesji
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-8 w-full relative rounded-[8px] bg-[var(--color-bg-elevated)] overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-[8px] transition-all duration-700"
                    style={{
                      width: `${widthPct}%`,
                      background: `linear-gradient(90deg, var(--color-chart-2), var(--color-chart-3))`,
                      opacity: 0.4 + (0.6 * (steps.length - i) / steps.length),
                    }}
                  />
                </div>
                {!isLast && s.dropoff != null && (
                  <div className="pl-2 flex items-center gap-2 text-[11px] text-[var(--color-accent-negative)] font-medium">
                    ↓ drop-off: {formatPct(s.dropoff)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard label="Cart rate" value={k.sessions > 0 ? k.addToCart / k.sessions : null} format="pct" />
        <ScoreCard label="Checkout rate" value={k.addToCart > 0 ? k.beginCheckout / k.addToCart : null} format="pct" />
        <ScoreCard label="Purchase rate" value={k.beginCheckout > 0 ? k.transactions / k.beginCheckout : null} format="pct" />
        <ScoreCard label="Bounce rate" value={k.bounceRate} format="pct" deltaInverted />
      </div>
    </div>
  );
}
