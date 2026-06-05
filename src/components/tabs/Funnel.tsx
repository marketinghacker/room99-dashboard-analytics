'use client';

import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import { SectionHead, HeroKpi } from '@/components/primitives/editorial';
import { DeltaBadge } from '@/components/primitives/DeltaBadge';
import { LoadingCard, ErrorCard } from '@/components/primitives/StateCard';
import { formatInt, formatPct } from '@/lib/format';

type Step = {
  event: string;
  label: string;
  users: number;
  conversionFromPrev: number | null;
  change?: number | null;
};
type Segment = { steps: Step[]; cr: number | null };

/** Różnica w punktach procentowych między segmentami. */
function PpDiff({ a, b }: { a: number | null; b: number | null }) {
  if (a == null || b == null) return <span style={{ color: 'var(--color-ink-tertiary)' }}>—</span>;
  const pp = (a - b) * 100;
  const good = pp >= 0;
  return (
    <span
      className="numeric text-[11px] font-semibold"
      style={{ color: good ? 'var(--color-accent-positive)' : 'var(--color-accent-negative)' }}
    >
      {good ? '+' : '−'}{Math.abs(pp).toFixed(1).replace('.', ',')} pp
    </span>
  );
}

/** Tabela porównawcza segmentów (Mobile vs Desktop / Nowi vs Powracający). */
function SegmentTable({
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  left: Segment;
  right: Segment;
  leftLabel: string;
  rightLabel: string;
}) {
  const totalUsers = (left.steps[0]?.users ?? 0) + (right.steps[0]?.users ?? 0);
  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-line-soft)' }}>
            <th className="table-header text-left px-4 py-3">Etap</th>
            <th className="table-header text-right px-4 py-3">{leftLabel}</th>
            <th className="table-header text-right px-4 py-3">{rightLabel}</th>
            <th className="table-header text-right px-4 py-3">Różnica</th>
          </tr>
        </thead>
        <tbody>
          {left.steps.map((ls, i) => {
            const rs = right.steps[i];
            const isFirst = i === 0;
            return (
              <tr key={ls.event} style={{ borderBottom: '1px solid var(--color-line-soft)' }}>
                <td className="px-4 py-3 table-cell font-medium">{ls.label}</td>
                {isFirst ? (
                  <>
                    <td className="px-4 py-3 text-right numeric table-cell">
                      {formatInt(ls.users)}
                      {totalUsers > 0 && (
                        <span className="text-[11px] ml-1" style={{ color: 'var(--color-ink-tertiary)' }}>
                          ({Math.round((ls.users / totalUsers) * 100)}%)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right numeric table-cell">
                      {formatInt(rs?.users ?? 0)}
                      {totalUsers > 0 && (
                        <span className="text-[11px] ml-1" style={{ color: 'var(--color-ink-tertiary)' }}>
                          ({Math.round(((rs?.users ?? 0) / totalUsers) * 100)}%)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right table-cell" style={{ color: 'var(--color-ink-tertiary)' }}>—</td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-right numeric table-cell">
                      {ls.conversionFromPrev != null ? formatPct(ls.conversionFromPrev) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right numeric table-cell">
                      {rs?.conversionFromPrev != null ? formatPct(rs.conversionFromPrev) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right table-cell">
                      <PpDiff a={ls.conversionFromPrev} b={rs?.conversionFromPrev ?? null} />
                    </td>
                  </>
                )}
              </tr>
            );
          })}
          <tr style={{ background: 'var(--color-bg-elevated)' }}>
            <td className="px-4 py-3 overline">CR ogólny</td>
            <td className="px-4 py-3 text-right numeric font-medium">{left.cr != null ? formatPct(left.cr) : '—'}</td>
            <td className="px-4 py-3 text-right numeric font-medium">{right.cr != null ? formatPct(right.cr) : '—'}</td>
            <td className="px-4 py-3 text-right"><PpDiff a={left.cr} b={right.cr} /></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function FunnelTab() {
  const { data, error, isLoading } = useFilteredSWR<any>('/api/data/funnel');

  if (isLoading) return <LoadingCard />;
  if (error) return <ErrorCard error={String(error.message ?? error)} />;
  if (!data?.steps) return <ErrorCard error="Brak danych lejka — sync ga4_funnel jeszcze nie zebrał danych" />;

  const steps: Step[] = data.steps;
  const maxUsers = Math.max(...steps.map((s) => s.users), 1);

  return (
    <div className="flex flex-col gap-10">
      <header>
        <div className="overline mb-2">Lejek · GA4 e-commerce</div>
        <h1 className="section-title" style={{ fontSize: 32, letterSpacing: '-0.02em', fontWeight: 500 }}>
          Lejek konwersji
        </h1>
        <p className="lede mt-2" style={{ fontSize: 14 }}>
          Liczony od <strong>użytkowników</strong> (GA4 totalUsers per zdarzenie) — ustalenie z klientem.
          Konwersja = % użytkowników poprzedniego etapu.
        </p>
      </header>

      <div className="grid gap-5" style={{ gridTemplateColumns: '1.25fr 1fr 1fr' }}>
        <HeroKpi label="Wejścia (sesje — użytkownicy)" value={steps[0]?.users ?? 0} format="int" primary hint="GA4: session_start, użytkownicy" />
        <HeroKpi label="Zakupy (użytkownicy)" value={steps[steps.length - 1]?.users ?? 0} format="int" hint="GA4: purchase, użytkownicy" />
        <HeroKpi
          label="CR ogólny (sesje → zakup)"
          value={(data.crTotal ?? 0) * 100}
          format="pct"
          hint="Użytkownicy z zakupem ÷ użytkownicy z sesją"
        />
      </div>

      {/* §01 — lejek wszyscy użytkownicy (tabela z draftu) */}
      <section>
        <SectionHead
          number="§01"
          title="Lejek konwersji — wszyscy użytkownicy"
          sub="Użytkownicy per etap + konwersja do następnego etapu. Zmiana vs wybrany okres porównawczy."
        />
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-line-soft)' }}>
                <th className="table-header text-left px-4 py-3">Etap</th>
                <th className="table-header text-left px-4 py-3" style={{ width: '28%' }}></th>
                <th className="table-header text-right px-4 py-3">Użytkownicy</th>
                <th className="table-header text-right px-4 py-3">Konwersja do nast. etapu</th>
                <th className="table-header text-right px-4 py-3">Zmiana</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s) => (
                <tr key={s.event} style={{ borderBottom: '1px solid var(--color-line-soft)' }}>
                  <td className="px-4 py-3 table-cell font-medium">{s.label}</td>
                  <td className="px-4 py-3">
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-elevated)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${(s.users / maxUsers) * 100}%`, background: 'var(--color-accent)' }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right numeric table-cell font-medium">{formatInt(s.users)}</td>
                  <td className="px-4 py-3 text-right numeric table-cell">
                    {s.conversionFromPrev != null ? formatPct(s.conversionFromPrev) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right"><DeltaBadge pct={s.change ?? null} size="xs" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* §02 — Mobile vs Desktop */}
      <section>
        <SectionHead
          number="§02"
          title="Lejek — Mobile vs Desktop"
          sub="Współczynniki przejść między krokami per urządzenie. Różnica w punktach procentowych."
        />
        <SegmentTable
          left={data.byDevice.mobile}
          right={data.byDevice.desktop}
          leftLabel="Mobile"
          rightLabel="Desktop"
        />
      </section>

      {/* §03 — Nowi vs Powracający */}
      <section>
        <SectionHead
          number="§03"
          title="Lejek — Nowi vs Powracający"
          sub="Współczynniki przejść między krokami per typ użytkownika (GA4 newVsReturning)."
        />
        <SegmentTable
          left={data.byUserType.new}
          right={data.byUserType.returning}
          leftLabel="Nowi klienci"
          rightLabel="Powracający"
        />
      </section>

      <p className="text-[11px] italic" style={{ color: 'var(--color-ink-tertiary)' }}>
        Definicja: {data.definition} Sumy użytkowników po segmentach mogą przekraczać total
        (jeden użytkownik może wystąpić na kilku urządzeniach).
      </p>
    </div>
  );
}
