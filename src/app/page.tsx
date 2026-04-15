'use client';

import SectionTitle from '@/components/SectionTitle';
import KPIGrid from '@/components/KPIGrid';
import KPICard from '@/components/KPICard';
import AlertBanner from '@/components/AlertBanner';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorBanner from '@/components/ErrorBanner';
import { PartialErrorBanner } from '@/components/ErrorBanner';
import { formatPLN, formatNumber, formatPercent } from '@/lib/formatters';
import { useDashboardData } from '@/hooks/useDashboardData';
import PlatformBadge from '@/components/PlatformBadge';
import type { Alert } from '@/lib/alerts';

interface MetricKPI {
  label: string;
  value: number;
  change?: number;
  format: string;
}

interface MarketingMetric {
  label: string;
  value: number;
  format: string;
}

interface PlatformSpendItem {
  platform: string;
  spend: number;
  spendShare: number;
}

interface ExecutiveSummaryData {
  revenue: MetricKPI;
  aov: MetricKPI;
  cr: MetricKPI;
  transactions: MetricKPI;
  sessions: MetricKPI;
  marketing: {
    totalSpend: MarketingMetric;
    costShare: MarketingMetric;
  };
  platformSpend: PlatformSpendItem[];
  alerts: Alert[];
  errors: Record<string, string | null>;
}

function fmtValue(value: number, format: string): string {
  switch (format) {
    case 'currency': return formatPLN(value);
    case 'percent': return formatPercent(value);
    case 'number': return formatNumber(value);
    default: return String(value);
  }
}

const PLATFORM_KEY_MAP: Record<string, string> = {
  'google-ads': 'google',
  'meta-ads': 'meta',
  'criteo': 'criteo',
};

export default function ExecutiveSummaryPage() {
  const { data, loading, error, refresh } = useDashboardData<ExecutiveSummaryData>(
    '/api/data/executive-summary'
  );

  if (loading) return <LoadingSkeleton cards={5} showTable />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return <ErrorBanner message="Brak danych" onRetry={refresh} />;

  const cos = data.marketing.costShare;

  return (
    <div className="flex flex-col gap-7 animate-fade-up">
      {/* Alerts */}
      {data.alerts && data.alerts.length > 0 && <AlertBanner alerts={data.alerts} />}
      {data.errors && <PartialErrorBanner errors={data.errors} />}

      {/* Hero KPIs */}
      <section>
        <SectionTitle>Kluczowe wskazniki</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-3">
          <KPICard
            label="Przychod (SHR)"
            value={formatPLN(data.revenue.value)}
            change={data.revenue.change}
            accent="var(--accent)"
          />
          <KPICard
            label="Transakcje"
            value={formatNumber(data.transactions.value)}
            change={data.transactions.change}
          />
          <KPICard
            label="AOV"
            value={formatPLN(data.aov.value)}
            change={data.aov.change}
          />
          <KPICard
            label="Sesje"
            value={formatNumber(data.sessions.value)}
            change={data.sessions.change}
          />
          <KPICard
            label="CR"
            value={formatPercent(data.cr.value)}
            change={data.cr.change}
          />
        </div>
      </section>

      {/* Marketing efficiency */}
      <section>
        <SectionTitle>Efektywnosc marketingu</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <KPICard
            label="Wydatki reklamowe"
            value={formatPLN(data.marketing.totalSpend.value)}
          />
          <KPICard
            label="COS (Cost of Sale)"
            value={formatPercent(cos.value)}
            accent={cos.value > 15 ? 'var(--red)' : cos.value > 10 ? 'var(--yellow)' : 'var(--green)'}
          />
        </div>
      </section>

      {/* Platform breakdown */}
      {data.platformSpend && data.platformSpend.length > 0 && (
        <section>
          <SectionTitle>Wydatki wg platformy</SectionTitle>
          <div className="bg-card rounded-xl overflow-hidden mt-3" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted text-left">Platforma</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted text-right">Wydatki</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted text-right">Udzial</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted text-left w-[30%]">Rozklad</th>
                </tr>
              </thead>
              <tbody>
                {data.platformSpend.map((ps) => (
                  <tr key={ps.platform} className="border-b border-border-light hover:bg-card-hover transition-colors">
                    <td className="px-4 py-3">
                      <PlatformBadge platform={PLATFORM_KEY_MAP[ps.platform] || ps.platform} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPLN(ps.spend)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{formatPercent(ps.spendShare)}</td>
                    <td className="px-4 py-3">
                      <div className="w-full bg-wire-bg rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${ps.spendShare}%`,
                            backgroundColor: ps.platform === 'google-ads' ? 'var(--google)'
                              : ps.platform === 'meta-ads' ? 'var(--meta)'
                              : 'var(--criteo)',
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-wire-bg font-bold text-[13px]">
                  <td className="px-4 py-3 text-text-secondary">Razem</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPLN(data.marketing.totalSpend.value)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-secondary">100%</td>
                  <td className="px-4 py-3" />
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
