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
  glow?: boolean;
}

export default function KPICard({
  label,
  value,
  change,
  changeDirection,
  prefix,
  suffix,
  accent,
  glow,
}: KPICardProps) {
  return (
    <div
      className={`glass-card p-5 flex flex-col gap-2 relative overflow-hidden ${glow ? 'kpi-glow' : ''}`}
    >
      {/* Accent top line */}
      {accent && (
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
        />
      )}

      {/* Label */}
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {label}
      </span>

      {/* Value */}
      <div className="text-[28px] font-extrabold leading-none tracking-tight tabular-nums" style={{ color: accent || 'var(--text)' }}>
        {prefix && (
          <span className="text-[18px] font-semibold text-text-secondary mr-1">{prefix}</span>
        )}
        {value}
        {suffix && (
          <span className="text-[12px] font-medium text-text-muted ml-2">{suffix}</span>
        )}
      </div>

      {/* Change */}
      {change !== undefined && (
        <div>
          <ChangeIndicator value={change} direction={changeDirection} size="sm" />
        </div>
      )}
    </div>
  );
}
