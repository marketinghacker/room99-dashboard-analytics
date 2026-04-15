'use client';

import SectionTitle from '@/components/SectionTitle';
import KPIGrid from '@/components/KPIGrid';
import KPICard from '@/components/KPICard';
import PlatformBadge from '@/components/PlatformBadge';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorBanner from '@/components/ErrorBanner';
import { formatPLN, formatPercent } from '@/lib/formatters';
import { useDashboardData } from '@/hooks/useDashboardData';

interface PlatformSpendItem {
  platform: string;
  spend: number;
  spendShare: number;
}

interface ExecutiveSummaryData {
  revenue: { value: number };
  marketing: {
    totalSpend: { value: number };
    costShare: { value: number };
  };
  platformSpend: PlatformSpendItem[];
}

const PLATFORM_KEY_MAP: Record<string, string> = {
  'google-ads': 'google',
  'meta-ads': 'meta',
  'criteo': 'criteo',
};

const PLATFORM_COLORS: Record<string, string> = {
  'google-ads': 'var(--google)',
  'meta-ads': 'var(--meta)',
  'criteo': 'var(--criteo)',
};

export default function PerformanceMarketingPage() {
  const { data, loading, error, refresh } = useDashboardData<ExecutiveSummaryData>(
    '/api/data/executive-summary'
  );

  if (loading) return <LoadingSkeleton cards={3} showTable />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return <ErrorBanner message="Brak danych" onRetry={refresh} />;

  const totalSpend = data.marketing.totalSpend.value;
  const cos = data.marketing.costShare.value;

  return (
    <div className="flex flex-col gap-7 animate-fade-up">
      <section>
        <SectionTitle>Podsumowanie wydatkow</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <KPICard label="Przychod (SHR)" value={formatPLN(data.revenue.value)} accent="var(--accent)" />
          <KPICard label="Wydatki reklamowe" value={formatPLN(totalSpend)} />
          <KPICard
            label="COS (Cost of Sale)"
            value={formatPercent(cos)}
            accent={cos > 15 ? 'var(--red)' : cos > 10 ? 'var(--yellow)' : 'var(--green)'}
          />
        </div>
      </section>

      <section>
        <SectionTitle>Wydatki wg platformy</SectionTitle>
        <div className="bg-card rounded-xl overflow-hidden mt-3" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted text-left">Platforma</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted text-right">Wydatki</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted text-right">Udzial</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted text-left w-[35%]">Rozklad</th>
              </tr>
            </thead>
            <tbody>
              {data.platformSpend.map((row) => (
                <tr key={row.platform} className="border-b border-border-light hover:bg-card-hover transition-colors">
                  <td className="px-4 py-3">
                    <PlatformBadge platform={PLATFORM_KEY_MAP[row.platform] || row.platform} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPLN(row.spend)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{formatPercent(row.spendShare)}</td>
                  <td className="px-4 py-3">
                    <div className="w-full bg-wire-bg rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${row.spendShare}%`, backgroundColor: PLATFORM_COLORS[row.platform] || '#888' }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              <tr className="bg-wire-bg font-bold">
                <td className="px-4 py-3 text-text-secondary">Razem</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatPLN(totalSpend)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-text-secondary">100%</td>
                <td className="px-4 py-3" />
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
