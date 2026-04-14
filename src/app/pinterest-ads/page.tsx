import fs from 'fs';
import path from 'path';
import FilterBar from '@/components/FilterBar';
import SectionTitle from '@/components/SectionTitle';
import KPIGrid from '@/components/KPIGrid';
import KPICard from '@/components/KPICard';
import { formatPLN, formatNumber, formatPercent, formatDecimal } from '@/lib/formatters';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'pinterest-ads.json'), 'utf-8'));

const campaignTypeBadgeStyles: Record<string, { bg: string; text: string }> = {
  'Shopping': { bg: '#e0f2f1', text: '#00695c' },
  'Conversion': { bg: '#fff3e0', text: '#e65100' },
  'Awareness': { bg: '#f3e5f5', text: '#6a1b9a' },
  'Traffic': { bg: '#fce4ec', text: '#c62828' },
};

interface Campaign {
  rank: number;
  name: string;
  type: string;
  spend: number;
  revenue: number;
  roas: number;
  cr: number;
  saves: number;
}

export default function PinterestAdsPage() {
  const { period, uploadedAt, kpis, topCampaigns } = data;

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        period={period.label}
        comparison="vs Poprzedni okres"
      />

      {/* Warning banner for manual data import */}
      {uploadedAt === null && (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--yellow)] bg-[var(--yellow-bg)] px-4 py-3">
          <svg className="shrink-0 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--yellow)" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-[13px] font-semibold text-[var(--yellow)]">Dane wymagaja importu recznego</p>
            <p className="text-[12px] text-[var(--text-secondary)]">
              Pinterest Ads API nie jest podlaczone. Dane na tej stronie pochodza z ostatniego recznego uploadu.
              Przejdz do panelu administracyjnego, aby zaimportowac aktualne dane.
            </p>
          </div>
        </div>
      )}

      <SectionTitle>Metryki ogolne — Pinterest Ads</SectionTitle>

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
          label={kpis.impressions.label}
          value={formatNumber(kpis.impressions.value)}
          change={kpis.impressions.change}
          changeDirection={kpis.impressions.changeDirection}
        />
        <KPICard
          label={kpis.clicks.label}
          value={formatNumber(kpis.clicks.value)}
          change={kpis.clicks.change}
          changeDirection={kpis.clicks.changeDirection}
        />
        <KPICard
          label={kpis.saves.label}
          value={formatNumber(kpis.saves.value)}
          change={kpis.saves.change}
          changeDirection={kpis.saves.changeDirection}
        />
        <KPICard
          label={kpis.ctr.label}
          value={formatPercent(kpis.ctr.value)}
          change={kpis.ctr.change}
          changeDirection={kpis.ctr.changeDirection}
        />
      </KPIGrid>

      {/* TOP 10 campaigns */}
      <SectionTitle>TOP 10 kampanii</SectionTitle>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-center w-10">#</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Kampania</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Typ</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Wydatki</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Przychod</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">ROAS</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">CR</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Zapisy</th>
            </tr>
          </thead>
          <tbody>
            {topCampaigns.map((c: Campaign) => {
              const badge = campaignTypeBadgeStyles[c.type] || { bg: '#f5f5f5', text: '#616161' };
              return (
                <tr key={c.rank} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                  <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{c.rank}</td>
                  <td className="px-3 py-2.5 font-medium">{c.name}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                      style={{ backgroundColor: badge.bg, color: badge.text }}
                    >
                      {c.type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">{formatPLN(c.spend)}</td>
                  <td className="px-3 py-2.5 text-right">{formatPLN(c.revenue)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">{formatDecimal(c.roas, 1)}</td>
                  <td className="px-3 py-2.5 text-right">{formatPercent(c.cr)}</td>
                  <td className="px-3 py-2.5 text-right">{formatNumber(c.saves)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
