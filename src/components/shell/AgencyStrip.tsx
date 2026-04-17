'use client';

/**
 * Thin announcement band visible only in agency role. CSS gate via
 * html[data-role="client"] .agency-only → display:none.
 */
import { useFilters } from '@/stores/filters';
import { resolvePeriod } from '@/lib/periods';
import { formatDateRangePL } from '@/lib/format';

export function AgencyStrip() {
  const period = useFilters((s) => s.period);
  const range = resolvePeriod(period);
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  return (
    <div
      className="agency-only agency-strip"
      style={{
        padding: '6px 32px',
      }}
    >
      <div className="flex items-center justify-between text-[10px] font-mono tracking-[0.12em] uppercase">
        <span>Agency workspace · insights, rekomendacje, alerty</span>
        <span style={{ color: 'var(--color-ink-tertiary)' }}>
          {hh}:{mm} · {formatDateRangePL(range.start, range.end)}
        </span>
      </div>
    </div>
  );
}
