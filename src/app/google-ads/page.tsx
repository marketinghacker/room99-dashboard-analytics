'use client';

import SectionTitle from '@/components/SectionTitle';
import KPIGrid from '@/components/KPIGrid';
import KPICard from '@/components/KPICard';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorBanner from '@/components/ErrorBanner';
import { formatPLN, formatNumber, formatPercent, formatDecimal } from '@/lib/formatters';
import { useDashboardData } from '@/hooks/useDashboardData';

interface GoogleAdsData {
  campaigns: Array<Record<string, unknown>> | null;
  shopping: unknown;
  types: unknown;
  totalSpend?: number;
  totalConversions?: number;
  totalConversionValue?: number;
  roas?: number;
}

export default function GoogleAdsPage() {
  const { data, loading, error, refresh } = useDashboardData<GoogleAdsData>(
    '/api/data/google-ads',
    { skipComparison: true }
  );

  if (loading) return <LoadingSkeleton cards={8} showTable />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return <ErrorBanner message="Brak danych" onRetry={refresh} />;

  const totalSpend = data.totalSpend || 0;
  const totalConversions = data.totalConversions || 0;
  const totalConversionValue = data.totalConversionValue || 0;
  const roas = data.roas || 0;
  const campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>Metryki ogolne — Google Ads</SectionTitle>

      <KPIGrid columns={4}>
        <KPICard label="Wydatki" value={formatPLN(totalSpend)} />
        <KPICard label="Przychod (konwersje)" value={formatPLN(totalConversionValue)} />
        <KPICard label="ROAS" value={formatDecimal(roas, 1)} />
        <KPICard label="Konwersje" value={formatNumber(totalConversions)} />
      </KPIGrid>

      {/* Campaigns table */}
      {campaigns.length > 0 && (
        <>
          <SectionTitle>Kampanie</SectionTitle>

          <div className="bg-card border border-border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-left">Kampania</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Wydatki</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Konwersje</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Wartosc konwersji</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.slice(0, 20).map((c, i) => {
                  const cost = Number(c.cost || c.spend || 0);
                  const convValue = Number(c.conversions_value || c.conversion_value || 0);
                  const conv = Number(c.conversions || 0);
                  const cRoas = cost > 0 ? convValue / cost : 0;
                  return (
                    <tr key={i} className="border-b border-border hover:bg-wire-bg transition-colors">
                      <td className="px-3 py-2.5 font-medium">{String(c.name || c.campaign || `Kampania ${i + 1}`)}</td>
                      <td className="px-3 py-2.5 text-right">{formatPLN(cost)}</td>
                      <td className="px-3 py-2.5 text-right">{formatNumber(conv)}</td>
                      <td className="px-3 py-2.5 text-right">{formatPLN(convValue)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{formatDecimal(cRoas, 1)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-wire-bg font-bold">
                  <td className="px-3 py-2.5">Razem</td>
                  <td className="px-3 py-2.5 text-right">{formatPLN(totalSpend)}</td>
                  <td className="px-3 py-2.5 text-right">{formatNumber(totalConversions)}</td>
                  <td className="px-3 py-2.5 text-right">{formatPLN(totalConversionValue)}</td>
                  <td className="px-3 py-2.5 text-right">{formatDecimal(roas, 1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
