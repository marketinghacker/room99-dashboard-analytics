import fs from 'fs';
import path from 'path';
import FilterBar from '@/components/FilterBar';
import SectionTitle from '@/components/SectionTitle';
import PlatformBadge from '@/components/PlatformBadge';
import ChangeIndicator from '@/components/ChangeIndicator';
import { formatPLN, formatPercent, formatDecimal } from '@/lib/formatters';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'performance-marketing.json'), 'utf-8'));

type PlatformKey = 'google' | 'meta' | 'pinterest' | 'criteo';

interface BudgetRow {
  platform: string;
  platformKey: PlatformKey;
  spend: number;
  share: number;
  change: number;
}

interface EfficiencyRow {
  platform: string;
  platformKey: PlatformKey;
  spend: number;
  revenue: number;
  roas: number;
  roasChange: number;
  cr: number;
  crChange: number;
  cpa: number;
  cpaChange: number;
}

export default function PerformanceMarketingPage() {
  const { period, budgetByPlatform, totalSpend, efficiency, totalRevenue, overallROAS } = data;

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        period={period.label}
        comparison="vs Poprzedni okres"
      />

      <SectionTitle>Budzet i udzial platform</SectionTitle>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Platforma</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Wydatki</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">% udzial</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Zmiana MoM</th>
            </tr>
          </thead>
          <tbody>
            {budgetByPlatform.map((row: BudgetRow) => (
              <tr key={row.platformKey} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                <td className="px-3 py-2.5">
                  <PlatformBadge platform={row.platformKey} />
                </td>
                <td className="px-3 py-2.5 text-right">{formatPLN(row.spend)}</td>
                <td className="px-3 py-2.5 text-right">{formatPercent(row.share)}</td>
                <td className="px-3 py-2.5 text-right">
                  <ChangeIndicator value={row.change} />
                </td>
              </tr>
            ))}
            <tr className="bg-[var(--wire-bg)] font-bold">
              <td className="px-3 py-2.5">Razem</td>
              <td className="px-3 py-2.5 text-right">{formatPLN(totalSpend)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(100)}</td>
              <td className="px-3 py-2.5 text-right">--</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SectionTitle>Efektywnosc platform</SectionTitle>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Platforma</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Przychod</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">ROAS</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">CPA</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">CR</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Zmiana ROAS</th>
            </tr>
          </thead>
          <tbody>
            {efficiency.map((row: EfficiencyRow) => (
              <tr key={row.platformKey} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                <td className="px-3 py-2.5">
                  <PlatformBadge platform={row.platformKey} />
                </td>
                <td className="px-3 py-2.5 text-right">{formatPLN(row.revenue)}</td>
                <td className="px-3 py-2.5 text-right">{formatDecimal(row.roas, 1)}</td>
                <td className="px-3 py-2.5 text-right">{formatPLN(row.cpa)}</td>
                <td className="px-3 py-2.5 text-right">{formatPercent(row.cr)}</td>
                <td className="px-3 py-2.5 text-right">
                  <ChangeIndicator value={row.roasChange} />
                </td>
              </tr>
            ))}
            <tr className="bg-[var(--wire-bg)] font-bold">
              <td className="px-3 py-2.5">Razem</td>
              <td className="px-3 py-2.5 text-right">{formatPLN(totalRevenue)}</td>
              <td className="px-3 py-2.5 text-right">{formatDecimal(overallROAS, 1)}</td>
              <td className="px-3 py-2.5 text-right">{formatPLN(totalSpend > 0 ? totalRevenue / (totalRevenue / totalSpend) : 0)}</td>
              <td className="px-3 py-2.5 text-right">--</td>
              <td className="px-3 py-2.5 text-right">--</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
