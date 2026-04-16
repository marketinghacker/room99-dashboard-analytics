'use client';

import SectionTitle from '@/components/SectionTitle';
import KPICard from '@/components/KPICard';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorBanner from '@/components/ErrorBanner';
import { PartialErrorBanner } from '@/components/ErrorBanner';
import { formatPLN, formatNumber, formatPercent } from '@/lib/formatters';
import { useDashboardData } from '@/hooks/useDashboardData';
import PlatformBadge from '@/components/PlatformBadge';
import type { Alert } from '@/lib/alerts';

interface MetricKPI { label: string; value: number; change?: number; format: string }
interface MarketingMetric { label: string; value: number; format: string }
interface PlatformSpendItem { platform: string; spend: number; spendShare: number }

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

const PM: Record<string, string> = { 'google-ads': 'google', 'meta-ads': 'meta', 'criteo': 'criteo' };

export default function ExecutiveSummaryPage() {
  const { data, loading, error, refresh } = useDashboardData<ExecutiveSummaryData>('/api/data/executive-summary');

  if (loading) return <LoadingSkeleton cards={5} showTable />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return <ErrorBanner message="Brak danych" onRetry={refresh} />;

  const cos = data.marketing.costShare;

  return (
    <div className="space-y-6">
      {data.alerts?.length > 0 && <div /> /* AlertBanner placeholder */}
      {data.errors && <PartialErrorBanner errors={data.errors} />}

      <SectionTitle>Kluczowe wskazniki biznesowe</SectionTitle>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Sesje na sklepie" value={formatNumber(data.sessions.value)} />
        <KPICard label="Wydatki marketingowe" value={formatPLN(data.marketing.totalSpend.value)} />
        <KPICard label="COS (udzial kosztow)" value={formatPercent(cos.value)} />
        <KPICard label="Transakcje" value={formatNumber(data.transactions.value)} />
      </div>

      <SectionTitle className="mt-8">Budzet i udzial platform</SectionTitle>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="text-left px-3 py-2.5 bg-wire-bg text-[11px] font-semibold uppercase tracking-[0.5px] text-text-secondary border-b-2 border-border">Platforma</th>
              <th className="text-right px-3 py-2.5 bg-wire-bg text-[11px] font-semibold uppercase tracking-[0.5px] text-text-secondary border-b-2 border-border">Wydatki</th>
              <th className="text-right px-3 py-2.5 bg-wire-bg text-[11px] font-semibold uppercase tracking-[0.5px] text-text-secondary border-b-2 border-border">% udzial</th>
            </tr>
          </thead>
          <tbody>
            {data.platformSpend?.map((ps) => (
              <tr key={ps.platform} className="border-b border-[#f0f0f0] hover:bg-wire-bg transition-colors">
                <td className="px-3 py-3"><PlatformBadge platform={PM[ps.platform] || ps.platform} /></td>
                <td className="px-3 py-3 text-right font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPLN(ps.spend)}</td>
                <td className="px-3 py-3 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPercent(ps.spendShare)}</td>
              </tr>
            ))}
            <tr className="bg-wire-bg font-bold">
              <td className="px-3 py-3">LACZNIE</td>
              <td className="px-3 py-3 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPLN(data.marketing.totalSpend.value)}</td>
              <td className="px-3 py-3 text-right">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
