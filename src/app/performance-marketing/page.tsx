'use client';

import SectionTitle from '@/components/SectionTitle';
import PlatformBadge from '@/components/PlatformBadge';
import ChangeIndicator from '@/components/ChangeIndicator';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorBanner from '@/components/ErrorBanner';
import { formatPLN, formatPercent, formatDecimal } from '@/lib/formatters';
import { useDashboardData } from '@/hooks/useDashboardData';

interface PlatformSpendItem {
  platform: string;
  spend: number;
  revenue: number;
  roas: number;
  spendShare: number;
}

interface ExecutiveSummaryData {
  revenue: { value: number };
  marketing: {
    totalSpend: { value: number };
    roas: { value: number };
  };
  platformSpend: PlatformSpendItem[];
}

const PLATFORM_KEY_MAP: Record<string, 'google' | 'meta' | 'criteo' | 'pinterest'> = {
  'google-ads': 'google',
  'meta-ads': 'meta',
  'criteo': 'criteo',
};

export default function PerformanceMarketingPage() {
  const { data, loading, error, refresh } = useDashboardData<ExecutiveSummaryData>(
    '/api/data/executive-summary'
  );

  if (loading) return <LoadingSkeleton cards={4} showTable />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return <ErrorBanner message="Brak danych" onRetry={refresh} />;

  const totalSpend = data.marketing.totalSpend.value;
  const totalRevenue = data.revenue.value;
  const overallROAS = data.marketing.roas.value;

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>Budzet i udzial platform</SectionTitle>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-left">Platforma</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Wydatki</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">% udzial</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Przychod</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {data.platformSpend.map((row) => (
              <tr key={row.platform} className="border-b border-border hover:bg-wire-bg transition-colors">
                <td className="px-3 py-2.5">
                  <PlatformBadge platform={PLATFORM_KEY_MAP[row.platform] || row.platform} />
                </td>
                <td className="px-3 py-2.5 text-right">{formatPLN(row.spend)}</td>
                <td className="px-3 py-2.5 text-right">{formatPercent(row.spendShare)}</td>
                <td className="px-3 py-2.5 text-right">{formatPLN(row.revenue)}</td>
                <td className="px-3 py-2.5 text-right">{formatDecimal(row.roas, 1)}</td>
              </tr>
            ))}
            <tr className="bg-wire-bg font-bold">
              <td className="px-3 py-2.5">Razem</td>
              <td className="px-3 py-2.5 text-right">{formatPLN(totalSpend)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(100)}</td>
              <td className="px-3 py-2.5 text-right">{formatPLN(totalRevenue)}</td>
              <td className="px-3 py-2.5 text-right">{formatDecimal(overallROAS, 1)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
