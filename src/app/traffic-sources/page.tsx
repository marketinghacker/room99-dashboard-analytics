'use client';

import SectionTitle from '@/components/SectionTitle';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorBanner from '@/components/ErrorBanner';
import { formatNumber, formatPercent } from '@/lib/formatters';
import { useDashboardData } from '@/hooks/useDashboardData';

interface TrafficRow {
  channel: string;
  sessions: number;
  [key: string]: unknown;
}

interface GA4Data {
  sessions: unknown;
  ecommerce: unknown;
  traffic: TrafficRow[] | { rows: TrafficRow[] } | unknown;
  funnel: unknown;
}

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
    <div className="flex flex-col gap-6">
      <SectionTitle>Performance kanalow</SectionTitle>

      {channels.length > 0 ? (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-left">Kanal</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Sesje</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">% udzial</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c, i) => {
                const sessions = Number(c.sessions || 0);
                const share = totalSessions > 0 ? (sessions / totalSessions) * 100 : 0;
                return (
                  <tr key={i} className="border-b border-border hover:bg-wire-bg transition-colors">
                    <td className="px-3 py-2.5 font-medium">{String(c.channel || c.sessionDefaultChannelGroup || `Kanal ${i + 1}`)}</td>
                    <td className="px-3 py-2.5 text-right">{formatNumber(sessions)}</td>
                    <td className="px-3 py-2.5 text-right">{formatPercent(share)}</td>
                  </tr>
                );
              })}
              <tr className="bg-wire-bg font-bold">
                <td className="px-3 py-2.5">Razem</td>
                <td className="px-3 py-2.5 text-right">{formatNumber(totalSessions)}</td>
                <td className="px-3 py-2.5 text-right">{formatPercent(100)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-text-secondary text-[13px]">
          Brak danych o zrodlach ruchu dla wybranego okresu.
        </div>
      )}

      {/* Attribution warning */}
      <div className="bg-yellow-bg border border-yellow/30 rounded-lg px-5 py-4 flex items-start gap-3">
        <div className="text-yellow mt-0.5 shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <div className="text-[13px] font-bold text-yellow mb-1">Uwaga: bias atrybucji GA4</div>
          <div className="text-[12px] text-text-secondary leading-relaxed">
            Dane GA4 opieraja sie na modelu atrybucji data-driven, ktory moze przypisywac konwersje inaczej niz platformy reklamowe.
          </div>
        </div>
      </div>
    </div>
  );
}
