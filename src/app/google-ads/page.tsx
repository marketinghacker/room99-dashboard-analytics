import fs from 'fs';
import path from 'path';
import FilterBar from '@/components/FilterBar';
import SectionTitle from '@/components/SectionTitle';
import KPIGrid from '@/components/KPIGrid';
import KPICard from '@/components/KPICard';
import ChangeIndicator from '@/components/ChangeIndicator';
import BarChart from '@/components/BarChart';
import { formatPLN, formatNumber, formatPercent, formatDecimal } from '@/lib/formatters';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'google-ads.json'), 'utf-8'));

const campaignTypeBadgeStyles: Record<string, { bg: string; text: string }> = {
  'Performance Max': { bg: '#e8eaf6', text: '#3949ab' },
  'PMax': { bg: '#e8eaf6', text: '#3949ab' },
  'Shopping': { bg: '#e0f2f1', text: '#00695c' },
  'Search': { bg: '#fff3e0', text: '#e65100' },
  'GDN (Display)': { bg: '#fce4ec', text: '#c62828' },
  'GDN': { bg: '#fce4ec', text: '#c62828' },
};

const microconversionStages: Record<string, { label: string; color: string; bg: string }> = {
  viewItem: { label: 'TOFU', color: '#1565c0', bg: '#e3f2fd' },
  addToCart: { label: 'MOFU', color: '#2e7d32', bg: '#e8f5e9' },
  beginCheckout: { label: 'MOFU', color: '#2e7d32', bg: '#e8f5e9' },
  addPaymentInfo: { label: 'BOFU', color: '#e65100', bg: '#fff3e0' },
  newsletter: { label: 'Lead', color: '#6a1b9a', bg: '#f3e5f5' },
};

interface CampaignType {
  type: string;
  spend: number;
  revenue: number;
  roas: number;
  share: number;
}

interface Campaign {
  rank: number;
  name: string;
  type: string;
  spend: number;
  revenue: number;
  roas: number;
  cr: number;
  transactions: number;
  issue?: string;
}

interface MicroConversion {
  label: string;
  count: number;
  change: number;
  rate: number;
}

export default function GoogleAdsPage() {
  const { period, kpis, campaignTypes, brandVsNonBrand, gscBrandTrend, topCampaigns, bottomCampaigns, microconversions } = data;

  // Prepare BarChart data from gscBrandTrend
  const barChartData = gscBrandTrend.labels.map((label: string, i: number) => ({
    label,
    value: gscBrandTrend.values[i],
    highlight: i === gscBrandTrend.labels.length - 1,
  }));

  const totalCampaignSpend = campaignTypes.reduce((s: number, c: CampaignType) => s + c.spend, 0);
  const totalCampaignRevenue = campaignTypes.reduce((s: number, c: CampaignType) => s + c.revenue, 0);
  const totalCampaignROAS = totalCampaignSpend > 0 ? totalCampaignRevenue / totalCampaignSpend : 0;

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        period={period.label}
        comparison="vs Poprzedni okres"
        extra={
          <div className="flex items-center gap-1">
            <button className="px-2.5 py-1 rounded text-[12px] font-medium bg-[var(--primary)] text-white">
              Brand + Non-Brand
            </button>
            <button className="px-2.5 py-1 rounded text-[12px] font-medium bg-[var(--wire-bg)] border border-[var(--border)] text-[var(--text)]">
              Brand
            </button>
            <button className="px-2.5 py-1 rounded text-[12px] font-medium bg-[var(--wire-bg)] border border-[var(--border)] text-[var(--text)]">
              Non-Brand
            </button>
          </div>
        }
      />

      <SectionTitle>Metryki ogolne — Google Ads</SectionTitle>

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
          label={kpis.ctr.label}
          value={formatPercent(kpis.ctr.value)}
          change={kpis.ctr.change}
          changeDirection={kpis.ctr.changeDirection}
        />
        <KPICard
          label={kpis.cpc.label}
          value={formatPLN(kpis.cpc.value)}
          change={kpis.cpc.change}
          changeDirection={kpis.cpc.changeDirection}
        />
      </KPIGrid>

      {/* Campaign Types */}
      <SectionTitle>Podzial wg typu kampanii</SectionTitle>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Typ kampanii</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Wydatki</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Przychod</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">ROAS</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">% budzetu</th>
            </tr>
          </thead>
          <tbody>
            {campaignTypes.map((ct: CampaignType) => {
              const badge = campaignTypeBadgeStyles[ct.type] || { bg: '#f5f5f5', text: '#616161' };
              return (
                <tr key={ct.type} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                  <td className="px-3 py-2.5">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                      style={{ backgroundColor: badge.bg, color: badge.text }}
                    >
                      {ct.type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">{formatPLN(ct.spend)}</td>
                  <td className="px-3 py-2.5 text-right">{formatPLN(ct.revenue)}</td>
                  <td className="px-3 py-2.5 text-right">{formatDecimal(ct.roas, 1)}</td>
                  <td className="px-3 py-2.5 text-right">{formatPercent(ct.share)}</td>
                </tr>
              );
            })}
            <tr className="bg-[var(--wire-bg)] font-bold">
              <td className="px-3 py-2.5">Razem</td>
              <td className="px-3 py-2.5 text-right">{formatPLN(totalCampaignSpend)}</td>
              <td className="px-3 py-2.5 text-right">{formatPLN(totalCampaignRevenue)}</td>
              <td className="px-3 py-2.5 text-right">{formatDecimal(totalCampaignROAS, 1)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(100)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Brand vs. Non-Brand */}
      <SectionTitle>Brand vs. Non-Brand</SectionTitle>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Segment</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Wydatki</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Przychod</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">ROAS</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">% budzetu</th>
            </tr>
          </thead>
          <tbody>
            {[brandVsNonBrand.brand, brandVsNonBrand.nonBrand].map((seg: { label: string; spend: number; revenue: number; roas: number; share: number }) => (
              <tr key={seg.label} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                <td className="px-3 py-2.5 font-medium">{seg.label}</td>
                <td className="px-3 py-2.5 text-right">{formatPLN(seg.spend)}</td>
                <td className="px-3 py-2.5 text-right">{formatPLN(seg.revenue)}</td>
                <td className="px-3 py-2.5 text-right">{formatDecimal(seg.roas, 1)}</td>
                <td className="px-3 py-2.5 text-right">{formatPercent(seg.share)}</td>
              </tr>
            ))}
            <tr className="bg-[var(--wire-bg)] font-bold">
              <td className="px-3 py-2.5">Razem</td>
              <td className="px-3 py-2.5 text-right">{formatPLN(brandVsNonBrand.brand.spend + brandVsNonBrand.nonBrand.spend)}</td>
              <td className="px-3 py-2.5 text-right">{formatPLN(brandVsNonBrand.brand.revenue + brandVsNonBrand.nonBrand.revenue)}</td>
              <td className="px-3 py-2.5 text-right">{formatDecimal((brandVsNonBrand.brand.revenue + brandVsNonBrand.nonBrand.revenue) / (brandVsNonBrand.brand.spend + brandVsNonBrand.nonBrand.spend), 1)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(100)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* GSC Brand Trend */}
      <SectionTitle>Brand Search — Trend zainteresowania (GSC)</SectionTitle>

      <BarChart data={barChartData} />

      {/* TOP 10 campaigns */}
      <SectionTitle>TOP 10 kampanii (wedlug ROAS)</SectionTitle>

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
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Transakcje</th>
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
                  <td className="px-3 py-2.5 text-right">{formatNumber(c.transactions)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* BOTTOM 3 campaigns */}
      <SectionTitle>BOTTOM 3 kampanie (wedlug ROAS)</SectionTitle>

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
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Problem</th>
            </tr>
          </thead>
          <tbody>
            {bottomCampaigns.map((c: Campaign) => {
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
                  <td className="px-3 py-2.5 text-right font-semibold text-[var(--red)]">{formatDecimal(c.roas, 1)}</td>
                  <td className="px-3 py-2.5 text-right">{formatPercent(c.cr)}</td>
                  <td className="px-3 py-2.5 text-[12px] text-[var(--text-secondary)]">{c.issue}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Microconversions */}
      <SectionTitle>Mikrokonwersje</SectionTitle>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Zdarzenie</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Etap lejka</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Liczba</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">% sesji</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Zmiana</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(microconversions).map(([key, mc]) => {
              const micro = mc as MicroConversion;
              const stage = microconversionStages[key] || { label: 'Inne', color: '#616161', bg: '#f5f5f5' };
              return (
                <tr key={key} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                  <td className="px-3 py-2.5 font-medium">{micro.label}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                      style={{ backgroundColor: stage.bg, color: stage.color }}
                    >
                      {stage.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">{formatNumber(micro.count)}</td>
                  <td className="px-3 py-2.5 text-right">{formatPercent(micro.rate)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <ChangeIndicator value={micro.change} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
