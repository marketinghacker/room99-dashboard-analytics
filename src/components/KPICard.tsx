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

export default function KPICard({ label, value, change, changeDirection, suffix }: KPICardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 px-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-text-secondary mb-3">
        {label}
      </div>
      <div className="text-[28px] font-bold text-text leading-[1.1] mb-1.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
        {suffix && <span className="text-[14px] font-normal text-text-secondary ml-1">{suffix}</span>}
      </div>
      {change !== undefined && (
        <ChangeIndicator value={change} direction={changeDirection} size="sm" />
      )}
    </div>
  );
}
