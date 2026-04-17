'use client';

/**
 * Thin announcement band visible only in agency role. CSS gate via
 * html[data-role="client"] .agency-only → display:none.
 *
 * IMPORTANT: the timestamp has to be computed client-side after mount —
 * rendering `new Date()` directly in SSR/CSR causes a hydration mismatch
 * (server minute != client minute), which puts React in fallback mode and
 * kills all subsequent re-renders (tab clicks stop working).
 */
import { useEffect, useState } from 'react';
import { useFilters } from '@/stores/filters';
import { resolvePeriod } from '@/lib/periods';
import { formatDateRangePL } from '@/lib/format';

export function AgencyStrip() {
  const period = useFilters((s) => s.period);
  const range = resolvePeriod(period);
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      );
    };
    update();
    const int = setInterval(update, 30_000);
    return () => clearInterval(int);
  }, []);

  return (
    <div
      className="agency-only agency-strip"
      style={{ padding: '6px 32px' }}
    >
      <div className="flex items-center justify-between text-[10px] font-mono tracking-[0.12em] uppercase">
        <span>Agency workspace · insights, rekomendacje, alerty</span>
        <span style={{ color: 'var(--color-ink-tertiary)' }}>
          {time} · {formatDateRangePL(range.start, range.end)}
        </span>
      </div>
    </div>
  );
}
