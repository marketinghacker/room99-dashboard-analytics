'use client';

import SectionTitle from '@/components/SectionTitle';
import KPIGrid from '@/components/KPIGrid';
import KPICard from '@/components/KPICard';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorBanner from '@/components/ErrorBanner';
import { formatPLN, formatNumber, formatPercent, formatDecimal } from '@/lib/formatters';
import { useDashboardData } from '@/hooks/useDashboardData';

interface Campaign {
  name: string;
  type: string;
  spend: number;
  conversions: number;
  convValue: number;
  clicks: number;
  impressions: number;
}

interface GoogleAdsData {
  campaigns: Campaign[] | null;
  totalSpend?: number;
  totalConversions?: number;
  totalConversionValue?: number;
  roas?: number;
}

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  'PMax': { bg: '#ede9fe', text: '#6d28d9' },
  'Shopping': { bg: '#d1fae5', text: '#047857' },
  'Search': { bg: '#fef3c7', text: '#b45309' },
};

export default function GoogleAdsPage() {
  const { data, loading, error, refresh } = useDashboardData<GoogleAdsData>(
    '/api/data/google-ads',
    { skipComparison: true }
  );

  if (loading) return <LoadingSkeleton cards={4} showTable />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return <ErrorBanner message="Brak danych" onRetry={refresh} />;

  const totalSpend = data.totalSpend || 0;
  const totalConvValue = data.totalConversionValue || 0;
  const totalConversions = data.totalConversions || 0;
  const roas = data.roas || 0;
  const campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];

  return (
    <div className="flex flex-col gap-7 animate-fade-up">
      <section>
        <SectionTitle>Google Ads — podsumowanie</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <KPICard label="Wydatki" value={formatPLN(totalSpend)} accent="var(--google)" />
          <KPICard label="Wartosc konwersji" value={formatPLN(totalConvValue)} />
          <KPICard label="ROAS (platforma)" value={formatDecimal(roas, 2)} />
          <KPICard label="Konwersje" value={formatDecimal(totalConversions, 0)} />
        </div>
      </section>

      {campaigns.length > 0 && (
        <section>
          <SectionTitle>Kampanie</SectionTitle>
          <div className="bg-card rounded-xl overflow-hidden overflow-x-auto mt-3" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted text-left">Kampania</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted text-left">Typ</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted text-right">Wydatki</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted text-right">Konwersje</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted text-right">Wart. konw.</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted text-right">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => {
                  const cost = Number(c.spend || 0);
                  const convVal = Number(c.convValue || 0);
                  const conv = Number(c.conversions || 0);
                  const cRoas = cost > 0 ? convVal / cost : 0;
                  const typeStyle = TYPE_STYLES[c.type] || { bg: '#f3f4f6', text: '#6b7280' };

                  return (
                    <tr key={i} className="border-b border-border-light hover:bg-card-hover transition-colors">
                      <td className="px-4 py-3 font-medium text-[13px]">{c.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                          style={{ backgroundColor: typeStyle.bg, color: typeStyle.text }}
                        >
                          {c.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatPLN(cost)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatDecimal(conv, 0)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPLN(convVal)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatDecimal(cRoas, 2)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-wire-bg font-bold">
                  <td className="px-4 py-3" colSpan={2}>Razem</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPLN(totalSpend)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatDecimal(totalConversions, 0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPLN(totalConvValue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatDecimal(roas, 2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
