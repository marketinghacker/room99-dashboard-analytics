'use client';

import SectionTitle from '@/components/SectionTitle';
import KPICard from '@/components/KPICard';
import PlatformBadge from '@/components/PlatformBadge';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorBanner from '@/components/ErrorBanner';
import { formatPLN, formatPercent } from '@/lib/formatters';
import { useDashboardData } from '@/hooks/useDashboardData';

interface PlatformSpendItem { platform: string; spend: number; spendShare: number; }
interface Data { revenue: { value: number }; marketing: { totalSpend: { value: number }; costShare: { value: number } }; platformSpend: PlatformSpendItem[] }

const PM: Record<string, string> = { 'google-ads': 'google', 'meta-ads': 'meta', 'criteo': 'criteo' };
const PC: Record<string, string> = { 'google-ads': 'var(--google)', 'meta-ads': 'var(--meta)', 'criteo': 'var(--criteo)' };

export default function PerformanceMarketingPage() {
  const { data, loading, error, refresh } = useDashboardData<Data>('/api/data/executive-summary');
  if (loading) return <LoadingSkeleton cards={3} showTable />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return <ErrorBanner message="Brak danych" onRetry={refresh} />;

  const cos = data.marketing.costShare.value;
  return (
    <div className="flex flex-col gap-8 animate-fade-up">
      <section>
        <SectionTitle>Podsumowanie wydatkow</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <KPICard label="Przychod (SHR)" value={formatPLN(data.revenue.value)} accent="var(--accent)" glow />
          <KPICard label="Wydatki reklamowe" value={formatPLN(data.marketing.totalSpend.value)} />
          <KPICard label="COS" value={formatPercent(cos)} accent={cos > 15 ? 'var(--red)' : cos > 10 ? 'var(--yellow)' : 'var(--green)'} />
        </div>
      </section>
      <section>
        <SectionTitle>Wydatki wg platformy</SectionTitle>
        <div className="glass-card overflow-hidden mt-4">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-glass-border">
              <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted text-left">Platforma</th>
              <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted text-right">Wydatki</th>
              <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted text-right">Udzial</th>
              <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted text-left w-[30%]" />
            </tr></thead>
            <tbody>
              {data.platformSpend.map((r) => (
                <tr key={r.platform} className="border-b border-glass-border/50 hover:bg-surface-hover transition-colors">
                  <td className="px-5 py-3.5"><PlatformBadge platform={PM[r.platform] || r.platform} /></td>
                  <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{formatPLN(r.spend)}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-text-secondary">{formatPercent(r.spendShare)}</td>
                  <td className="px-5 py-3.5">
                    <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${r.spendShare}%`, backgroundColor: PC[r.platform] || '#888', boxShadow: `0 0 8px ${PC[r.platform] || '#888'}40` }} />
                    </div>
                  </td>
                </tr>
              ))}
              <tr className="bg-surface">
                <td className="px-5 py-3.5 font-bold text-text-secondary">Razem</td>
                <td className="px-5 py-3.5 text-right font-bold tabular-nums">{formatPLN(data.marketing.totalSpend.value)}</td>
                <td className="px-5 py-3.5 text-right tabular-nums text-text-muted">100%</td>
                <td className="px-5 py-3.5" />
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
