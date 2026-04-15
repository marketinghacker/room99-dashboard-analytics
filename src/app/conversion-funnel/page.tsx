'use client';

import SectionTitle from '@/components/SectionTitle';
import FunnelChart from '@/components/FunnelChart';
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

interface FunnelStep {
  name: string;
  users: number;
  conversionRate: number;
}

function extractFunnelSteps(funnel: unknown): FunnelStep[] {
  if (!funnel) return [];

  // Try to parse various funnel response formats
  if (Array.isArray(funnel)) {
    return funnel.map((s: Record<string, unknown>, i: number) => ({
      name: String(s.name || s.step || `Krok ${i + 1}`),
      users: Number(s.users || s.activeUsers || s.value || 0),
      conversionRate: Number(s.conversionRate || s.rate || 0),
    }));
  }

  if (typeof funnel === 'object' && funnel !== null) {
    const obj = funnel as Record<string, unknown>;
    if (Array.isArray(obj.steps)) return extractFunnelSteps(obj.steps);
    if (Array.isArray(obj.rows)) return extractFunnelSteps(obj.rows);
    if (Array.isArray(obj.data)) return extractFunnelSteps(obj.data);
  }

  return [];
}

export default function ConversionFunnelPage() {
  const { data, loading, error, refresh } = useDashboardData<GA4Data>(
    '/api/data/ga4',
    { skipComparison: true }
  );

  if (loading) return <LoadingSkeleton cards={0} showChart showTable />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return <ErrorBanner message="Brak danych" onRetry={refresh} />;

  const funnelSteps = extractFunnelSteps(data.funnel);

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>Lejek konwersji</SectionTitle>

      {funnelSteps.length > 0 ? (
        <>
          <FunnelChart steps={funnelSteps} />

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-left">Etap</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Uzytkownicy</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Konwersja</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-wire-bg border-b-2 border-border text-right">Odpady</th>
                </tr>
              </thead>
              <tbody>
                {funnelSteps.map((s, i) => {
                  const dropoff = i > 0 && funnelSteps[i - 1].users > 0
                    ? ((funnelSteps[i - 1].users - s.users) / funnelSteps[i - 1].users) * 100
                    : null;
                  return (
                    <tr key={i} className="border-b border-border hover:bg-wire-bg transition-colors">
                      <td className="px-3 py-2.5 font-medium">{s.name}</td>
                      <td className="px-3 py-2.5 text-right">{formatNumber(s.users)}</td>
                      <td className="px-3 py-2.5 text-right">{formatPercent(s.conversionRate)}</td>
                      <td className="px-3 py-2.5 text-right">
                        {dropoff !== null ? (
                          <span className="text-red">{formatPercent(dropoff)}</span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Overall CR */}
          {funnelSteps.length >= 2 && (
            <div className="bg-primary-light border border-primary/30 rounded-lg px-5 py-4 flex items-center gap-3">
              <div className="text-primary">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </div>
              <span className="text-[14px] font-bold text-primary">
                CR ogolny: {formatPercent(
                  funnelSteps[0].users > 0
                    ? (funnelSteps[funnelSteps.length - 1].users / funnelSteps[0].users) * 100
                    : 0
                )}
                <span className="font-normal text-[12px] ml-2">(Sesje do zakupu)</span>
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-text-secondary text-[13px]">
          Brak danych o lejku konwersji dla wybranego okresu.
        </div>
      )}
    </div>
  );
}
