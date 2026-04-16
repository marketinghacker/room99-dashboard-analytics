'use client';

import { formatPLN, formatPLN2, formatInt, formatPct } from '@/lib/format';
import { DeltaBadge } from './DeltaBadge';
import { cn } from '@/components/ui/cn';

type Format = 'pln' | 'pln2' | 'int' | 'pct' | 'decimal' | 'text';

type Props = {
  label: string;
  value: number | string | null | undefined;
  format: Format;
  delta?: number | null;
  deltaInverted?: boolean;
  hint?: string;
  className?: string;
};

function fmt(v: number | string | null | undefined, f: Format): string {
  if (v == null) return '—';
  if (f === 'text') return String(v);
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '—';
  if (f === 'pln') return formatPLN(n);
  if (f === 'pln2') return formatPLN2(n);
  if (f === 'int') return formatInt(n);
  if (f === 'pct') return formatPct(n);
  return new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n).replace(/\u00A0|\u202F/g, ' ');
}

export function ScoreCard({ label, value, format, delta, deltaInverted, hint, className }: Props) {
  return (
    <div className={cn('card card-hover p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="overline">{label}</span>
        {delta != null && <DeltaBadge pct={delta} invert={deltaInverted} size="xs" />}
      </div>
      <div className="mt-2 text-[22px] font-semibold text-[var(--color-ink-primary)] leading-[1.15] numeric">
        {fmt(value, format)}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-[var(--color-ink-tertiary)]">{hint}</div>}
    </div>
  );
}
