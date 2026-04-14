import fs from 'fs';
import path from 'path';
import FilterBar from '@/components/FilterBar';
import SectionTitle from '@/components/SectionTitle';
import PlatformBadge from '@/components/PlatformBadge';
import ChangeIndicator from '@/components/ChangeIndicator';
import { formatPLN, formatNumber, formatPercent, formatDecimal } from '@/lib/formatters';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'product-catalogs.json'), 'utf-8'));

interface CatalogItem {
  catalog: string;
  platform: 'google' | 'meta' | 'pinterest' | 'criteo';
  totalProducts: number;
  activeProducts: number;
  disapproved: number;
  pending: number;
  approvalRate: number;
  change: number;
}

interface TopProduct {
  rank: number;
  name: string;
  sku: string;
  impressions: number;
  clicks: number;
  ctr: number;
  revenue: number;
  transactions: number;
}

interface ProblemProduct {
  rank: number;
  name: string;
  sku: string;
  impressions: number;
  clicks: number;
  ctr: number;
  revenue: number;
  transactions: number;
  issue: string;
}

export default function ProductCatalogsPage() {
  const { period, catalogPerformance, topDisplayedProducts, highImpressionsLowSales } = data;

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        period={period.label}
        comparison="vs Poprzedni okres"
      />

      <SectionTitle>Performance katalogow</SectionTitle>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Katalog</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Platforma</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Produkty</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Aktywne</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Odrzucone</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">% zatwierdzenia</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Zmiana</th>
            </tr>
          </thead>
          <tbody>
            {catalogPerformance.map((c: CatalogItem, idx: number) => (
              <tr key={idx} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                <td className="px-3 py-2.5 border-b border-[var(--border)] font-medium">{c.catalog}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)]">
                  <PlatformBadge platform={c.platform} />
                </td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatNumber(c.totalProducts)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatNumber(c.activeProducts)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatNumber(c.disapproved)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatPercent(c.approvalRate)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">
                  <ChangeIndicator value={c.change} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionTitle>Najczesciej wyswietlane produkty</SectionTitle>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Produkt</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Wyswietlenia</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Klikniecia</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">CTR</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Sprzedaz</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Przychod</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {topDisplayedProducts.map((p: TopProduct) => (
              <tr key={p.rank} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                <td className="px-3 py-2.5 border-b border-[var(--border)]">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">{p.sku}</div>
                </td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatNumber(p.impressions)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatNumber(p.clicks)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatPercent(p.ctr)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatNumber(p.transactions)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatPLN(p.revenue)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatDecimal(p.revenue / (p.clicks > 0 ? p.clicks : 1) * (p.ctr / 100), 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionTitle>Produkty z wysokimi wyswietleniami, niska sprzedaza</SectionTitle>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Produkt</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Wyswietlenia</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Sprzedaz</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">CR</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Problem</th>
            </tr>
          </thead>
          <tbody>
            {highImpressionsLowSales.map((p: ProblemProduct) => (
              <tr key={p.rank} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                <td className="px-3 py-2.5 border-b border-[var(--border)]">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">{p.sku}</div>
                </td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatNumber(p.impressions)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatNumber(p.transactions)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatPercent(p.clicks > 0 ? (p.transactions / p.clicks) * 100 : 0)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)]">
                  <span className="inline-block bg-[var(--red-bg)] text-[var(--red)] text-[11px] font-semibold rounded-full px-2.5 py-0.5">
                    {p.issue}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
