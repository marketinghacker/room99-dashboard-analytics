import fs from 'fs';
import path from 'path';
import FilterBar from '@/components/FilterBar';
import SectionTitle from '@/components/SectionTitle';
import KPIGrid from '@/components/KPIGrid';
import KPICard from '@/components/KPICard';
import ChangeIndicator from '@/components/ChangeIndicator';
import { formatPLN, formatNumber, formatPercent, formatDecimal } from '@/lib/formatters';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'criteo.json'), 'utf-8'));

export default function CriteoPage() {
  const { period, kpis, campaigns } = data;

  const totalSpend = campaigns.reduce((s: number, c: { spend: number }) => s + c.spend, 0);
  const totalRevenue = campaigns.reduce((s: number, c: { revenue: number }) => s + c.revenue, 0);
  const totalImpressions = campaigns.reduce((s: number, c: { impressions: number }) => s + c.impressions, 0);
  const totalClicks = campaigns.reduce((s: number, c: { clicks: number }) => s + c.clicks, 0);
  const totalTransactions = campaigns.reduce((s: number, c: { transactions: number }) => s + c.transactions, 0);
  const totalROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const totalCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const totalCR = totalClicks > 0 ? (totalTransactions / totalClicks) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        period={period.label}
        comparison="vs Poprzedni okres"
      />

      <SectionTitle>Metryki ogolne — Criteo</SectionTitle>

      <KPIGrid columns={4}>
        <KPICard
          label={kpis.spend.label}
          value={formatPLN(kpis.spend.value)}
          change={kpis.spend.change}
          changeDirection={kpis.spend.changeDirection}
        />
        <KPICard
          label={kpis.revenue.label}
          value={formatPLN(kpis.revenue.value)}
          change={kpis.revenue.change}
          changeDirection={kpis.revenue.changeDirection}
        />
        <KPICard
          label={kpis.roas.label}
          value={formatDecimal(kpis.roas.value, 1)}
          change={kpis.roas.change}
          changeDirection={kpis.roas.changeDirection}
        />
        <KPICard
          label={kpis.cr.label}
          value={formatPercent(kpis.cr.value)}
          change={kpis.cr.change}
          changeDirection={kpis.cr.changeDirection}
        />
      </KPIGrid>

      <KPIGrid columns={4}>
        <KPICard
          label={kpis.reach.label}
          value={formatNumber(kpis.reach.value)}
          change={kpis.reach.change}
          changeDirection={kpis.reach.changeDirection}
        />
        <KPICard
          label={kpis.impressions.label}
          value={formatNumber(kpis.impressions.value)}
          change={kpis.impressions.change}
          changeDirection={kpis.impressions.changeDirection}
        />
        <KPICard
          label={kpis.frequency.label}
          value={formatDecimal(kpis.frequency.value, 2)}
          change={kpis.frequency.change}
          changeDirection={kpis.frequency.changeDirection}
        />
        <KPICard
          label={kpis.ctr.label}
          value={formatPercent(kpis.ctr.value)}
          change={kpis.ctr.change}
          changeDirection={kpis.ctr.changeDirection}
        />
      </KPIGrid>

      <SectionTitle>Podzial na kampanie</SectionTitle>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Kampania</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Wydatki</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Przychod</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">ROAS</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">CTR</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Czestotliwosc</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Zmiana ROAS</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c: { id: string; name: string; spend: number; revenue: number; roas: number; ctr: number; impressions: number; clicks: number }) => {
              const freq = c.impressions > 0 && c.clicks > 0 ? c.impressions / (c.impressions / (c.clicks / (c.ctr / 100))) : 0;
              return (
                <tr key={c.id} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                  <td className="px-3 py-2.5 border-b border-[var(--border)] font-medium">{c.name}</td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatPLN(c.spend)}</td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatPLN(c.revenue)}</td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatDecimal(c.roas, 1)}</td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatPercent(c.ctr)}</td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatDecimal(c.impressions / c.clicks, 1)}</td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">
                    <ChangeIndicator value={c.roas > 21 ? 3 : c.roas < 21 ? -2 : 0} />
                  </td>
                </tr>
              );
            })}
            <tr className="bg-[var(--wire-bg)] font-bold">
              <td className="px-3 py-2.5">Razem</td>
              <td className="px-3 py-2.5 text-right">{formatPLN(totalSpend)}</td>
              <td className="px-3 py-2.5 text-right">{formatPLN(totalRevenue)}</td>
              <td className="px-3 py-2.5 text-right">{formatDecimal(totalROAS, 1)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(totalCTR)}</td>
              <td className="px-3 py-2.5 text-right">{formatDecimal(totalImpressions / totalClicks, 1)}</td>
              <td className="px-3 py-2.5 text-right">
                <ChangeIndicator value={kpis.roas.change} direction={kpis.roas.changeDirection} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
