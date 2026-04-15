'use client';

import SectionTitle from '@/components/SectionTitle';
import KPIGrid from '@/components/KPIGrid';
import KPICard from '@/components/KPICard';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorBanner from '@/components/ErrorBanner';
import { formatPLN, formatNumber, formatPercent, formatDecimal } from '@/lib/formatters';
import { useDashboardData } from '@/hooks/useDashboardData';

interface MetaAdsData {
  totalSpend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  revenue: number;
  roas: number;
  campaigns: unknown;
}

export default function MetaAdsPage() {
  const { data, loading, error, refresh } = useDashboardData<MetaAdsData>(
    '/api/data/meta-ads',
    { skipComparison: true }
  );

  if (loading) return <LoadingSkeleton cards={8} />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return <ErrorBanner message="Brak danych" onRetry={refresh} />;

  return (
    <div className="flex flex-col gap-7 animate-fade-up">
      <section>
        <SectionTitle>Meta Ads — podsumowanie</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <KPICard label="Wydatki" value={formatPLN(data.totalSpend)} accent="var(--meta)" />
          <KPICard label="Przychod (platforma)" value={formatPLN(data.revenue)} />
          <KPICard label="ROAS (platforma)" value={formatDecimal(data.roas, 2)} />
          <KPICard label="Zakupy" value={formatNumber(data.conversions)} />
        </div>
      </section>

      <section>
        <SectionTitle>Metryki ruchu</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <KPICard label="Wyswietlenia" value={formatNumber(data.impressions)} />
          <KPICard label="Klikniecia" value={formatNumber(data.clicks)} />
          <KPICard label="CTR" value={formatPercent(data.ctr)} />
          <KPICard label="CPC" value={formatPLN(data.cpc)} />
        </div>
      </section>
    </div>
  );
}
