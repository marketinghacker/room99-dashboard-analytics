'use client';

import SectionTitle from '@/components/SectionTitle';
import ChangeIndicator from '@/components/ChangeIndicator';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorBanner from '@/components/ErrorBanner';
import { formatPLN, formatNumber, formatPercent } from '@/lib/formatters';
import { useDashboardData } from '@/hooks/useDashboardData';

interface Product {
  name: string;
  sku: string;
  category?: string;
  subcategory?: string;
  revenue: number;
  quantity: number;
  averagePrice?: number;
}

interface CategoryAggregate {
  category: string;
  revenue: number;
  quantity: number;
  productCount: number;
}

interface BaseLinkerData {
  revenue: number;
  orderCount: number;
  aov: number;
  products: Product[];
  categoryAggregates?: CategoryAggregate[];
}

export default function TopProductsPage() {
  const { data, loading, error, refresh } = useDashboardData<BaseLinkerData>(
    '/api/data/baselinker',
    { skipComparison: true }
  );

  if (loading) return <LoadingSkeleton cards={0} showTable />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return <ErrorBanner message="Brak danych" onRetry={refresh} />;

  const products = data.products || [];
  const categories = data.categoryAggregates || [];
  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>TOP produktow (wedlug sprzedazy)</SectionTitle>

      {products.length > 0 ? (
        <div className="bg-card border border-border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-left">#</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-left">Produkt</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-left">Kategoria</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Ilosc (szt.)</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Przychod</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">% udzial</th>
              </tr>
            </thead>
            <tbody>
              {products.slice(0, 25).map((p, i) => {
                const share = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0;
                return (
                  <tr key={i} className="border-b border-border hover:bg-wire-bg transition-colors">
                    <td className="px-3 py-2.5 text-text-secondary">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-[11px] text-text-secondary">{p.sku}</div>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary text-[12px]">{p.category || '—'}</td>
                    <td className="px-3 py-2.5 text-right">{formatNumber(p.quantity)}</td>
                    <td className="px-3 py-2.5 text-right">{formatPLN(p.revenue)}</td>
                    <td className="px-3 py-2.5 text-right">{formatPercent(share)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-text-secondary text-[13px]">
          Brak danych o produktach dla wybranego okresu.
        </div>
      )}

      {/* Category aggregates */}
      {categories.length > 0 && (
        <>
          <SectionTitle>Sprzedaz wg kategorii</SectionTitle>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-left">Kategoria</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Przychod</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Ilosc (szt.)</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Produkty</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">% udzial</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, i) => {
                  const share = totalRevenue > 0 ? (cat.revenue / totalRevenue) * 100 : 0;
                  return (
                    <tr key={i} className="border-b border-border hover:bg-wire-bg transition-colors">
                      <td className="px-3 py-2.5 font-medium">{cat.category}</td>
                      <td className="px-3 py-2.5 text-right">{formatPLN(cat.revenue)}</td>
                      <td className="px-3 py-2.5 text-right">{formatNumber(cat.quantity)}</td>
                      <td className="px-3 py-2.5 text-right">{formatNumber(cat.productCount)}</td>
                      <td className="px-3 py-2.5 text-right">{formatPercent(share)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
