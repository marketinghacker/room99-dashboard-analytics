'use client';

import SectionTitle from '@/components/SectionTitle';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorBanner from '@/components/ErrorBanner';
import { formatNumber, formatPercent } from '@/lib/formatters';
import { useDashboardData } from '@/hooks/useDashboardData';

interface GA4Data {
  sessions: unknown;
  ecommerce: unknown;
  traffic: unknown;
  funnel: unknown;
}

interface TrafficRow {
  channel?: string;
  sessionDefaultChannelGroup?: string;
  sessions: number;
  totalUsers?: number;
}

const CHANNEL_COLORS: Record<string, string> = {
  'Paid Social': '#0668E1',
  'Cross-network': '#ff6b35',
  'Paid Search': '#4285f4',
  'Organic Search': '#16a34a',
  'Direct': '#dc2626',
  'Organic Social': '#E60023',
  'Paid Shopping': '#8b5cf6',
  'Paid Other': '#d97706',
  'Display': '#ec4899',
  'Referral': '#6366f1',
};

function extractTrafficRows(traffic: unknown): TrafficRow[] {
  if (!traffic) return [];
  if (Array.isArray(traffic)) return traffic;
  if (typeof traffic === 'object' && traffic !== null) {
    const obj = traffic as Record<string, unknown>;
    if (Array.isArray(obj.rows)) return obj.rows;
    if (Array.isArray(obj.data)) return obj.data;
  }
  return [];
}

export default function TrafficSourcesPage() {
  const { data, loading, error, refresh } = useDashboardData<GA4Data>(
    '/api/data/ga4',
    { skipComparison: true }
  );

  if (loading) return <LoadingSkeleton cards={0} showTable />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return <ErrorBanner message="Brak danych" onRetry={refresh} />;

  const channels = extractTrafficRows(data.traffic);
  const totalSessions = channels.reduce((s, c) => s + Number(c.sessions || 0), 0);

  return (
    <div className="flex flex-col gap-7 animate-fade-up">
      <section>
        <SectionTitle>Zrodla ruchu — GA4</SectionTitle>

        {channels.length > 0 ? (
          <div className="bg-card rounded-xl overflow-hidden mt-3" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted text-left">Kanal</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted text-right">Sesje</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted text-right">Udzial</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted text-left w-[30%]">Rozklad</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((c, i) => {
                  const sessions = Number(c.sessions || 0);
                  const share = totalSessions > 0 ? (sessions / totalSessions) * 100 : 0;
                  const channelName = String(c.channel || c.sessionDefaultChannelGroup || `Kanal ${i + 1}`);
                  const color = CHANNEL_COLORS[channelName] || '#9ca3af';

                  return (
                    <tr key={i} className="border-b border-border-light hover:bg-card-hover transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-medium">{channelName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatNumber(sessions)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{formatPercent(share)}</td>
                      <td className="px-4 py-3">
                        <div className="w-full bg-wire-bg rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: color }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-wire-bg font-bold">
                  <td className="px-4 py-3 text-text-secondary">Razem</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(totalSessions)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-secondary">100%</td>
                  <td className="px-4 py-3" />
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-card rounded-xl p-8 text-center text-text-muted text-[13px] mt-3" style={{ boxShadow: 'var(--shadow-sm)' }}>
            Brak danych o zrodlach ruchu.
          </div>
        )}
      </section>
    </div>
  );
}
