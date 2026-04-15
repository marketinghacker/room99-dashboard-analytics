'use client';

import SectionTitle from '@/components/SectionTitle';
import KPICard from '@/components/KPICard';
import AlertBanner from '@/components/AlertBanner';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorBanner from '@/components/ErrorBanner';
import { PartialErrorBanner } from '@/components/ErrorBanner';
import { formatPLN, formatNumber, formatPercent } from '@/lib/formatters';
import { useDashboardData } from '@/hooks/useDashboardData';
import PlatformBadge from '@/components/PlatformBadge';
import type { Alert } from '@/lib/alerts';

interface MetricKPI { label: string; value: number; change?: number; format: string; }
interface MarketingMetric { label: string; value: number; format: string; }
interface PlatformSpendItem { platform: string; spend: number; spendShare: number; }

interface ExecutiveSummaryData {
  revenue: MetricKPI;
  aov: MetricKPI;
  cr: MetricKPI;
  transactions: MetricKPI;
  sessions: MetricKPI;
  marketing: { totalSpend: MarketingMetric; costShare: MarketingMetric };
  platformSpend: PlatformSpendItem[];
  alerts: Alert[];
  errors: Record<string, string | null>;
}

const PLATFORM_MAP: Record<string, string> = { 'google-ads': 'google', 'meta-ads': 'meta', 'criteo': 'criteo' };
const PLATFORM_COLORS: Record<string, string> = { 'google-ads': 'var(--google)', 'meta-ads': 'var(--meta)', 'criteo': 'var(--criteo)' };

export default function ExecutiveSummaryPage() {
  const { data, loading, error, refresh } = useDashboardData<ExecutiveSummaryData>('/api/data/executive-summary');

  if (loading) return <LoadingSkeleton cards={5} showTable />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return <ErrorBanner message="Brak danych" onRetry={refresh} />;

  const cos = data.marketing.costShare;
  const cosColor = cos.value > 15 ? 'var(--red)' : cos.value > 10 ? 'var(--yellow)' : 'var(--green)';

  return (
    <div className="flex flex-col gap-8">
      {data.alerts?.length > 0 && <AlertBanner alerts={data.alerts} />}
      {data.errors && <PartialErrorBanner errors={data.errors} />}

      {/* Hero KPIs */}
      <section className="animate-fade-up">
        <SectionTitle>Kluczowe wskazniki</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          <KPICard label="Przychod" value={formatPLN(data.revenue.value)} change={data.revenue.change} accent="var(--accent)" glow />
          <KPICard label="Transakcje" value={formatNumber(data.transactions.value)} change={data.transactions.change} />
          <KPICard label="AOV" value={formatPLN(data.aov.value)} change={data.aov.change} />
          <KPICard label="Sesje" value={formatNumber(data.sessions.value)} change={data.sessions.change} />
          <KPICard label="CR" value={formatPercent(data.cr.value)} change={data.cr.change} />
        </div>
      </section>

      {/* Marketing */}
      <section className="animate-fade-up stagger-2">
        <SectionTitle>Efektywnosc marketingu</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <KPICard label="Wydatki reklamowe" value={formatPLN(data.marketing.totalSpend.value)} />
          <KPICard label="COS (Cost of Sale)" value={formatPercent(cos.value)} accent={cosColor} />
        </div>
      </section>

      {/* Platform breakdown */}
      {data.platformSpend?.length > 0 && (
        <section className="animate-fade-up stagger-3">
          <SectionTitle>Wydatki wg platformy</SectionTitle>
          <div className="glass-card overflow-hidden mt-4">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-glass-border">
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted text-left">Platforma</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted text-right">Wydatki</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted text-right">Udzial</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted text-left w-[30%]" />
                </tr>
              </thead>
              <tbody>
                {data.platformSpend.map((ps) => (
                  <tr key={ps.platform} className="border-b border-glass-border/50 hover:bg-surface-hover transition-colors">
                    <td className="px-5 py-3.5">
                      <PlatformBadge platform={PLATFORM_MAP[ps.platform] || ps.platform} />
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-text">{formatPLN(ps.spend)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-text-secondary">{formatPercent(ps.spendShare)}</td>
                    <td className="px-5 py-3.5">
                      <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${ps.spendShare}%`,
                            backgroundColor: PLATFORM_COLORS[ps.platform] || '#888',
                            boxShadow: `0 0 8px ${PLATFORM_COLORS[ps.platform] || '#888'}40`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-surface">
                  <td className="px-5 py-3.5 font-bold text-text-secondary text-[12px]">Razem</td>
                  <td className="px-5 py-3.5 text-right font-bold tabular-nums text-text">{formatPLN(data.marketing.totalSpend.value)}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-text-muted">100%</td>
                  <td className="px-5 py-3.5" />
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
