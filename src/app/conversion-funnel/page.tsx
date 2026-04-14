import fs from 'fs';
import path from 'path';
import FilterBar from '@/components/FilterBar';
import SectionTitle from '@/components/SectionTitle';
import FunnelChart from '@/components/FunnelChart';
import ChangeIndicator from '@/components/ChangeIndicator';
import { formatNumber, formatPercent } from '@/lib/formatters';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'conversion-funnel.json'), 'utf-8'));

interface FunnelStep {
  step: string;
  label: string;
  value: number;
  rate: number;
  dropoff: number | null;
}

export default function ConversionFunnelPage() {
  const { period, overallFunnel, deviceComparison, userTypeComparison } = data;

  const funnelSteps = overallFunnel.steps.map((s: FunnelStep) => ({
    name: s.label,
    users: s.value,
    conversionRate: s.rate,
  }));

  const deviceSteps = [
    { label: 'Sesje', mobileKey: 'sessions', desktopKey: 'sessions' },
    { label: 'Wyswietlenie produktu', mobileKey: 'productView', desktopKey: 'productView', mobileRate: 'productViewRate', desktopRate: 'productViewRate' },
    { label: 'Dodanie do koszyka', mobileKey: 'addToCart', desktopKey: 'addToCart', mobileRate: 'addToCartRate', desktopRate: 'addToCartRate' },
    { label: 'Checkout', mobileKey: 'checkout', desktopKey: 'checkout', mobileRate: 'checkoutRate', desktopRate: 'checkoutRate' },
    { label: 'Zakup', mobileKey: 'purchase', desktopKey: 'purchase', mobileRate: 'purchaseRate', desktopRate: 'purchaseRate' },
  ];

  const userSteps = [
    { label: 'Sesje', newKey: 'sessions', retKey: 'sessions' },
    { label: 'Wyswietlenie produktu', newKey: 'productView', retKey: 'productView', newRate: 'productViewRate', retRate: 'productViewRate' },
    { label: 'Dodanie do koszyka', newKey: 'addToCart', retKey: 'addToCart', newRate: 'addToCartRate', retRate: 'addToCartRate' },
    { label: 'Checkout', newKey: 'checkout', retKey: 'checkout', newRate: 'checkoutRate', retRate: 'checkoutRate' },
    { label: 'Zakup', newKey: 'purchase', retKey: 'purchase', newRate: 'purchaseRate', retRate: 'purchaseRate' },
  ];

  const { mobile, desktop } = deviceComparison;
  const { new: newUsers, returning: returningUsers } = userTypeComparison;

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        period={period.label}
        comparison="vs Poprzedni okres"
        extra={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-secondary)] font-medium">Urzadzenie:</span>
              <div className="bg-[var(--wire-bg)] border border-[var(--border)] rounded px-2.5 py-1 text-[var(--text)] font-medium select-none">
                Wszystkie
              </div>
            </div>
            <div className="w-px h-5 bg-[var(--border)]" />
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-secondary)] font-medium">Typ uzytkownika:</span>
              <div className="bg-[var(--wire-bg)] border border-[var(--border)] rounded px-2.5 py-1 text-[var(--text)] font-medium select-none">
                Wszyscy
              </div>
            </div>
          </div>
        }
      />

      <SectionTitle>Lejek konwersji — Wszyscy uzytkownicy</SectionTitle>

      <FunnelChart steps={funnelSteps} />

      {/* Funnel data table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Etap</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Uzytkownicy</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Konwersja do nastepnego etapu</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Odpady</th>
            </tr>
          </thead>
          <tbody>
            {overallFunnel.steps.map((s: FunnelStep, idx: number) => (
              <tr key={idx} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                <td className="px-3 py-2.5 border-b border-[var(--border)] font-medium">{s.label}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatNumber(s.value)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">{formatPercent(s.rate)}</td>
                <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">
                  {s.dropoff !== null ? (
                    <span className="text-[var(--red)]">{formatPercent(s.dropoff)}</span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Overall CR info box */}
      <div className="bg-[#e8f0fe] border border-[#4285f4] rounded-lg px-5 py-4 flex items-center gap-3">
        <div className="text-[#1a73e8]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </div>
        <div>
          <span className="text-[14px] font-bold text-[#1a73e8]">
            CR ogolny: {formatPercent(overallFunnel.overallCR)}
          </span>
          <span className="text-[12px] text-[#1a73e8] ml-2">
            (Sesje do zakupu)
          </span>
        </div>
      </div>

      <SectionTitle>Lejek — Mobile vs Desktop</SectionTitle>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Etap</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Mobile</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Desktop</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Roznica</th>
            </tr>
          </thead>
          <tbody>
            {deviceSteps.map((step, idx) => {
              const mobileVal = mobile[step.mobileKey as keyof typeof mobile] as number;
              const desktopVal = desktop[step.desktopKey as keyof typeof desktop] as number;
              const mobileRate = step.mobileRate ? (mobile[step.mobileRate as keyof typeof mobile] as number) : null;
              const desktopRate = step.desktopRate ? (desktop[step.desktopRate as keyof typeof desktop] as number) : null;
              const diff = mobileRate !== null && desktopRate !== null ? mobileRate - desktopRate : null;

              return (
                <tr key={idx} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                  <td className="px-3 py-2.5 border-b border-[var(--border)] font-medium">{step.label}</td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">
                    <div>{formatNumber(mobileVal)}</div>
                    {mobileRate !== null && (
                      <div className="text-[11px] text-[var(--text-secondary)]">{formatPercent(mobileRate)}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">
                    <div>{formatNumber(desktopVal)}</div>
                    {desktopRate !== null && (
                      <div className="text-[11px] text-[var(--text-secondary)]">{formatPercent(desktopRate)}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">
                    {diff !== null ? (
                      <ChangeIndicator value={diff} />
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
            {/* CR row */}
            <tr className="bg-[var(--wire-bg)] font-bold">
              <td className="px-3 py-2.5">CR ogolny</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(mobile.cr)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(desktop.cr)}</td>
              <td className="px-3 py-2.5 text-right">
                <ChangeIndicator value={mobile.cr - desktop.cr} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <SectionTitle>Lejek — Nowi vs Powracajacy</SectionTitle>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-left">Etap</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Nowi klienci</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Powracajacy</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--wire-bg)] border-b-2 border-[var(--border)] text-right">Roznica</th>
            </tr>
          </thead>
          <tbody>
            {userSteps.map((step, idx) => {
              const newVal = newUsers[step.newKey as keyof typeof newUsers] as number;
              const retVal = returningUsers[step.retKey as keyof typeof returningUsers] as number;
              const newRate = step.newRate ? (newUsers[step.newRate as keyof typeof newUsers] as number) : null;
              const retRate = step.retRate ? (returningUsers[step.retRate as keyof typeof returningUsers] as number) : null;
              const diff = newRate !== null && retRate !== null ? newRate - retRate : null;

              return (
                <tr key={idx} className="border-b border-[var(--border)] hover:bg-[var(--wire-bg)] transition-colors">
                  <td className="px-3 py-2.5 border-b border-[var(--border)] font-medium">{step.label}</td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">
                    <div>{formatNumber(newVal)}</div>
                    {newRate !== null && (
                      <div className="text-[11px] text-[var(--text-secondary)]">{formatPercent(newRate)}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">
                    <div>{formatNumber(retVal)}</div>
                    {retRate !== null && (
                      <div className="text-[11px] text-[var(--text-secondary)]">{formatPercent(retRate)}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)] text-right">
                    {diff !== null ? (
                      <ChangeIndicator value={diff} />
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
            {/* CR row */}
            <tr className="bg-[var(--wire-bg)] font-bold">
              <td className="px-3 py-2.5">CR ogolny</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(newUsers.cr)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(returningUsers.cr)}</td>
              <td className="px-3 py-2.5 text-right">
                <ChangeIndicator value={newUsers.cr - returningUsers.cr} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
