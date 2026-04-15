'use client';

import SectionTitle from '@/components/SectionTitle';
import KPIGrid from '@/components/KPIGrid';
import KPICard from '@/components/KPICard';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorBanner from '@/components/ErrorBanner';
import { formatPLN, formatNumber, formatPercent, formatDecimal } from '@/lib/formatters';
import { useDashboardData } from '@/hooks/useDashboardData';

interface CriteoCampaign {
  id: string;
  name: string;
  spend: number;
  clicks: number;
  displays: number;
  roas: number;
  revenue: number;
}

interface CriteoData {
  totalSpend: number;
  clicks: number;
  displays: number;
  roas: number;
  campaigns: CriteoCampaign[];
}

export default function CriteoPage() {
  const { data, loading, error, refresh } = useDashboardData<CriteoData>(
    '/api/data/criteo',
    { skipComparison: true }
  );

  if (loading) return <LoadingSkeleton cards={4} showTable />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return <ErrorBanner message="Brak danych" onRetry={refresh} />;

  const totalRevenue = data.totalSpend * data.roas;
  const ctr = data.displays > 0 ? (data.clicks / data.displays) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>Metryki ogolne — Criteo</SectionTitle>

      <KPIGrid columns={4}>
        <KPICard label="Wydatki" value={formatPLN(data.totalSpend)} />
        <KPICard label="Przychod (est.)" value={formatPLN(totalRevenue)} />
        <KPICard label="ROAS" value={formatDecimal(data.roas, 1)} />
        <KPICard label="CTR" value={formatPercent(ctr)} />
      </KPIGrid>

      <KPIGrid columns={2}>
        <KPICard label="Wyswietlenia" value={formatNumber(data.displays)} />
        <KPICard label="Klikniecia" value={formatNumber(data.clicks)} />
      </KPIGrid>

      {/* Campaigns table */}
      {data.campaigns && data.campaigns.length > 0 && (
        <>
          <SectionTitle>Podzial na kampanie</SectionTitle>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-left">Kampania</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Wydatki</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Klikniecia</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Wyswietlenia</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-border hover:bg-wire-bg transition-colors">
                    <td className="px-3 py-2.5 font-medium">{c.name}</td>
                    <td className="px-3 py-2.5 text-right">{formatPLN(c.spend)}</td>
                    <td className="px-3 py-2.5 text-right">{formatNumber(c.clicks)}</td>
                    <td className="px-3 py-2.5 text-right">{formatNumber(c.displays)}</td>
                    <td className="px-3 py-2.5 text-right">{formatDecimal(c.roas, 1)}</td>
                  </tr>
                ))}
                <tr className="bg-wire-bg font-bold">
                  <td className="px-3 py-2.5">Razem</td>
                  <td className="px-3 py-2.5 text-right">{formatPLN(data.totalSpend)}</td>
                  <td className="px-3 py-2.5 text-right">{formatNumber(data.clicks)}</td>
                  <td className="px-3 py-2.5 text-right">{formatNumber(data.displays)}</td>
                  <td className="px-3 py-2.5 text-right">{formatDecimal(data.roas, 1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
