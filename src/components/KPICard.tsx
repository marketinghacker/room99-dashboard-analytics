'use client';

import ChangeIndicator from './ChangeIndicator';

interface KPICardProps {
  label: string;
  value: string;
  change?: number | string;
  changeDirection?: 'up' | 'down' | 'neutral';
  prefix?: string;
  suffix?: string;
  accent?: string;
}

export default function KPICard({
  label,
  value,
  change,
  changeDirection,
  prefix,
  suffix,
  accent,
}: KPICardProps) {
  return (
    <div
      className="bg-card rounded-xl p-5 flex flex-col gap-1.5 relative overflow-hidden transition-shadow hover:shadow-[var(--shadow-md)]"
      style={{ boxShadow: 'var(--shadow-sm)', borderLeft: accent ? `3px solid ${accent}` : undefined }}
    >
      {/* Label */}
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {label}
      </span>

      {/* Value */}
      <div className="text-[32px] font-bold leading-none text-text tabular-nums tracking-tight">
        {prefix && (
          <span className="text-[20px] font-medium text-text-secondary mr-0.5">{prefix}</span>
        )}
        {value}
        {suffix && (
          <span className="text-[13px] font-medium text-text-muted ml-1.5">{suffix}</span>
        )}
      </div>

      {/* Change */}
      {change !== undefined && (
        <div className="mt-0.5">
          <ChangeIndicator value={change} direction={changeDirection} size="sm" />
        </div>
      )}
    </div>
  );
}
