import fs from 'fs';
import path from 'path';
import FilterBar from '@/components/FilterBar';
import SectionTitle from '@/components/SectionTitle';
import ChangeIndicator from '@/components/ChangeIndicator';
import { formatPLN, formatNumber, formatPercent } from '@/lib/formatters';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'top-products.json'), 'utf-8'));

interface Product {
  rank: number;
  name: string;
  sku: string;
  category: string;
  revenue: number;
  transactions: number;
  aov: number;
  change: number;
}

interface GrowthProduct {
  rank: number;
  name: string;
  sku: string;
  revenue: number;
  change: number;
  previousRevenue: number;
  driver: string;
}

function getTrendIndicator(change: number): { text: string; color: string } {
  if (change >= 15) return { text: '\u2197 Wzrost', color: 'text-[var(--green)]' };
  if (change >= 5) return { text: '\u2192 Stabilny', color: 'text-[var(--text-secondary)]' };
  if (change >= 0) return { text: '\u2192 Stabilny', color: 'text-[var(--text-secondary)]' };
  return { text: '\u2198 Spadek', color: 'text-[var(--red)]' };
}

export default function TopProductsPage() {
  const { period, top25, topGrowth, topDecline } = data;

  const totalRevenue = top25.reduce((s: number, p: Product) => s + p.revenue, 0);

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        period={period.label}
        comparison="vs Poprzednie 7 dni"
      />

      <SectionTitle>TOP 25 produktow (wedlug sprzedazy)</SectionTitle>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">#</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Produkt</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Kategoria</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Sprzedaz (szt.)</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Przychod</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">% udzial</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Zmiana WoW</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Trend</th>
            </tr>
          </thead>
          <tbody>
            {top25.map((p: Product) => {
              const share = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0;
              const trend = getTrendIndicator(p.change);
              return (
                <tr key={p.rank} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-[var(--text-secondary)]">{p.rank}</td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)]">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-[11px] text-[var(--text-secondary)]">{p.sku}</div>
                  </td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-[var(--text-secondary)] text-[12px]">{p.category}</td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatNumber(p.transactions)}</td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatPLN(p.revenue)}</td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatPercent(share)}</td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">
                    <ChangeIndicator value={p.change} />
                  </td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)]">
                    <span className={`text-[12px] font-semibold ${trend.color}`}>{trend.text}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SectionTitle>TOP 5 produktow — Najwiekszy wzrost</SectionTitle>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">#</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Produkt</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Przychod</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Poprz. przychod</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Zmiana</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Driver</th>
            </tr>
          </thead>
          <tbody>
            {topGrowth.map((p: GrowthProduct) => (
              <tr key={p.rank} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-[var(--text-secondary)]">{p.rank}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)]">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">{p.sku}</div>
                </td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatPLN(p.revenue)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatPLN(p.previousRevenue)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">
                  <ChangeIndicator value={p.change} />
                </td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-[12px] text-[var(--text-secondary)]">{p.driver}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionTitle>BOTTOM 5 produktow — Najwiekszy spadek</SectionTitle>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">#</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Produkt</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Przychod</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Poprz. przychod</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Zmiana</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Driver</th>
            </tr>
          </thead>
          <tbody>
            {topDecline.map((p: GrowthProduct) => (
              <tr key={p.rank} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-[var(--text-secondary)]">{p.rank}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)]">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">{p.sku}</div>
                </td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatPLN(p.revenue)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatPLN(p.previousRevenue)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">
                  <ChangeIndicator value={p.change} />
                </td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-[12px] text-[var(--text-secondary)]">{p.driver}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
