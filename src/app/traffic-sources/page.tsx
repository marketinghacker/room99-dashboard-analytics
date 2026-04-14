import fs from 'fs';
import path from 'path';
import FilterBar from '@/components/FilterBar';
import SectionTitle from '@/components/SectionTitle';
import TrendChart from '@/components/TrendChart';
import ChangeIndicator from '@/components/ChangeIndicator';
import { formatPLN, formatNumber, formatPercent } from '@/lib/formatters';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'traffic-sources.json'), 'utf-8'));

interface Channel {
  channel: string;
  sessions: number;
  share: number;
  addToCart: number;
  addToCartRate: number;
  purchases: number;
  cr: number;
  crChange: number;
  revenue: number;
  revenueShare: number;
}

interface RevenueShare {
  channel: string;
  share: number;
}

export default function TrafficSourcesPage() {
  const { period, channels, revenueShareByChannel, crTrend } = data;

  const totalSessions = channels.reduce((s: number, c: Channel) => s + c.sessions, 0);
  const totalAddToCart = channels.reduce((s: number, c: Channel) => s + c.addToCart, 0);
  const totalPurchases = channels.reduce((s: number, c: Channel) => s + c.purchases, 0);
  const totalRevenue = channels.reduce((s: number, c: Channel) => s + c.revenue, 0);
  const totalCR = totalSessions > 0 ? (totalPurchases / totalSessions) * 100 : 0;

  // Transform crTrend data for TrendChart component
  const trendData = crTrend.labels.map((label: string, idx: number) => ({
    period: label,
    organicSearch: crTrend.organicSearch?.[idx] ?? 0,
    paidSearch: crTrend.paidSearch?.[idx] ?? 0,
    paidSocial: crTrend.paidSocial?.[idx] ?? 0,
    direct: crTrend.direct?.[idx] ?? 0,
    crossNetwork: crTrend.crossNetwork?.[idx] ?? 0,
    referral: crTrend.referral?.[idx] ?? 0,
    organicSocial: crTrend.organicSocial?.[idx] ?? 0,
  }));

  const trendLines = [
    { key: 'paidSearch', color: '#4285f4', label: 'Paid Search' },
    { key: 'organicSearch', color: '#34a853', label: 'Organic Search' },
    { key: 'direct', color: '#ea4335', label: 'Direct' },
    { key: 'crossNetwork', color: '#ff6d01', label: 'Cross-network' },
    { key: 'organicSocial', color: '#E60023', label: 'Organic Social' },
    { key: 'paidSocial', color: '#0668E1', label: 'Paid Social' },
    { key: 'referral', color: '#9334e6', label: 'Referral' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        period={period.label}
        comparison="vs Poprzedni okres"
      />

      <SectionTitle>Performance kanalow</SectionTitle>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Kanal</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Sesje</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Dodanie do koszyka</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Zakup</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">CR</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Przychod</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Zmiana CR</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c: Channel, idx: number) => (
              <tr key={idx} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                <td className="px-3 py-2.5 border-b border-[var(--border)] font-medium">{c.channel}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatNumber(c.sessions)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatNumber(c.addToCart)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatNumber(c.purchases)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatPercent(c.cr)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatPLN(c.revenue)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">
                  <ChangeIndicator value={c.crChange} />
                </td>
              </tr>
            ))}
            <tr className="bg-[var(--wire-bg)] font-bold">
              <td className="px-3 py-2.5">Razem</td>
              <td className="px-3 py-2.5 text-right">{formatNumber(totalSessions)}</td>
              <td className="px-3 py-2.5 text-right">{formatNumber(totalAddToCart)}</td>
              <td className="px-3 py-2.5 text-right">{formatNumber(totalPurchases)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(totalCR)}</td>
              <td className="px-3 py-2.5 text-right">{formatPLN(totalRevenue)}</td>
              <td className="px-3 py-2.5 text-right">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SectionTitle>Udzial kanalow w przychodzie</SectionTitle>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Kanal</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Przychod</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">% udzial</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left" style={{ width: '40%' }}>Udzial wizualny</th>
            </tr>
          </thead>
          <tbody>
            {revenueShareByChannel.map((r: RevenueShare, idx: number) => {
              const channelData = channels.find((c: Channel) => c.channel === r.channel);
              return (
                <tr key={idx} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                  <td className="px-3 py-2.5 border-b border-[var(--border)] font-medium">{r.channel}</td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{channelData ? formatPLN(channelData.revenue) : '—'}</td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatPercent(r.share)}</td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)]">
                    <div className="w-full bg-[var(--wire-bg)] rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${r.share}%`,
                          backgroundColor: trendLines[idx]?.color ?? '#4285f4',
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SectionTitle>Trendy wspolczynnika konwersji wedlug kanalow</SectionTitle>

      <TrendChart data={trendData} lines={trendLines} />

      {/* Warning box about GA4 attribution */}
      <div className="bg-[#fff8e1] border border-[#ffc107] rounded-lg px-5 py-4 flex items-start gap-3">
        <div className="text-[#f57f17] mt-0.5 shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <div className="text-[13px] font-bold text-[#e65100] mb-1">Uwaga: bias atrybucji GA4</div>
          <div className="text-[12px] text-[#bf360c] leading-relaxed">
            Dane GA4 opieraja sie na modelu atrybucji data-driven, ktory moze przypisywac konwersje inaczej niz platformy reklamowe.
            Porownujac dane GA4 z raportami Google Ads, Meta Ads czy Criteo nalezy uwzglednic roznice w modelach atrybucji.
            Bezposrednie porownanie wartosci konwersji miedzy platformami moze prowadzic do blednych wnioskow.
          </div>
        </div>
      </div>
    </div>
  );
}
