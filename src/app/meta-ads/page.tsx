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

  if (loading) return <LoadingSkeleton cards={8} showTable />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return <ErrorBanner message="Brak danych" onRetry={refresh} />;

  const cr = data.clicks > 0 ? (data.conversions / data.clicks) * 100 : 0;
  const campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>Metryki ogolne — Meta Ads</SectionTitle>

      <KPIGrid columns={4}>
        <KPICard label="Wydatki" value={formatPLN(data.totalSpend)} />
        <KPICard label="Przychod" value={formatPLN(data.revenue)} />
        <KPICard label="ROAS" value={formatDecimal(data.roas, 1)} />
        <KPICard label="CR" value={formatPercent(cr)} />
      </KPIGrid>

      <KPIGrid columns={4}>
        <KPICard label="Wyswietlenia" value={formatNumber(data.impressions)} />
        <KPICard label="Klikniecia" value={formatNumber(data.clicks)} />
        <KPICard label="CTR" value={formatPercent(data.ctr)} />
        <KPICard label="CPC" value={formatPLN(data.cpc)} />
      </KPIGrid>

      {/* Campaign insights */}
      {campaigns.length > 0 && (
        <>
          <SectionTitle>Kampanie</SectionTitle>
          <div className="bg-card border border-border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-left">Kampania</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Wydatki</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Wyswietlenia</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Klikniecia</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">CTR</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.slice(0, 20).map((c: Record<string, unknown>, i: number) => (
                  <tr key={i} className="border-b border-border hover:bg-wire-bg transition-colors">
                    <td className="px-3 py-2.5 font-medium">{String(c.campaign_name || c.name || `Kampania ${i + 1}`)}</td>
                    <td className="px-3 py-2.5 text-right">{formatPLN(Number(c.spend || 0))}</td>
                    <td className="px-3 py-2.5 text-right">{formatNumber(Number(c.impressions || 0))}</td>
                    <td className="px-3 py-2.5 text-right">{formatNumber(Number(c.clicks || 0))}</td>
                    <td className="px-3 py-2.5 text-right">{formatPercent(Number(c.ctr || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
