'use client';

import SectionTitle from '@/components/SectionTitle';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorBanner from '@/components/ErrorBanner';
import { formatPLN, formatNumber, formatPercent, formatDecimal } from '@/lib/formatters';
import { useDashboardData } from '@/hooks/useDashboardData';

interface ShoppingProduct {
  item_id?: string;
  title?: string;
  brand?: string;
  impressions?: number;
  clicks?: number;
  cost?: number;
  conversions?: number;
  conversions_value?: number;
  [key: string]: unknown;
}

interface GoogleAdsData {
  campaigns: unknown;
  shopping: ShoppingProduct[] | { rows: ShoppingProduct[] } | null;
  types: unknown;
  totalSpend?: number;
  roas?: number;
}

function extractShoppingProducts(shopping: unknown): ShoppingProduct[] {
  if (!shopping) return [];
  if (Array.isArray(shopping)) return shopping;
  if (typeof shopping === 'object' && shopping !== null) {
    const obj = shopping as Record<string, unknown>;
    if (Array.isArray(obj.rows)) return obj.rows;
    if (Array.isArray(obj.data)) return obj.data;
  }
  return [];
}

export default function ProductCatalogsPage() {
  const { data, loading, error, refresh } = useDashboardData<GoogleAdsData>(
    '/api/data/google-ads',
    { skipComparison: true, extraParams: { section: 'shopping' } }
  );

  if (loading) return <LoadingSkeleton cards={0} showTable />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return <ErrorBanner message="Brak danych" onRetry={refresh} />;

  const products = extractShoppingProducts(data.shopping);

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>Katalog produktow — Google Shopping</SectionTitle>

      {products.length > 0 ? (
        <div className="bg-card border border-border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-left">Produkt</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Wyswietlenia</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Klikniecia</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">CTR</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Koszt</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Konwersje</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Przychod</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {products.slice(0, 30).map((p, i) => {
                const impressions = Number(p.impressions || 0);
                const clicks = Number(p.clicks || 0);
                const cost = Number(p.cost || 0);
                const convValue = Number(p.conversions_value || 0);
                const conv = Number(p.conversions || 0);
                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                const roas = cost > 0 ? convValue / cost : 0;

                return (
                  <tr key={i} className="border-b border-border hover:bg-wire-bg transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{String(p.title || `Produkt ${i + 1}`)}</div>
                      <div className="text-[11px] text-text-secondary">{String(p.item_id || '')}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right">{formatNumber(impressions)}</td>
                    <td className="px-3 py-2.5 text-right">{formatNumber(clicks)}</td>
                    <td className="px-3 py-2.5 text-right">{formatPercent(ctr)}</td>
                    <td className="px-3 py-2.5 text-right">{formatPLN(cost)}</td>
                    <td className="px-3 py-2.5 text-right">{formatNumber(conv)}</td>
                    <td className="px-3 py-2.5 text-right">{formatPLN(convValue)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{formatDecimal(roas, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-text-secondary text-[13px]">
          Brak danych o katalogach produktow. Dane wymagaja polaczenia z Google Merchant Center.
        </div>
      )}
    </div>
  );
}
