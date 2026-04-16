'use client';

import { formatDelta } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

type Props = {
  pct: number | null | undefined;
  /** Flip meaning: true => lower is better (for COS/CPC/CPM). */
  invert?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
};

export function DeltaBadge({ pct, invert = false, size = 'sm', className }: Props) {
  const d = formatDelta(pct);
  // When invert is true (for COS/CPC), a decrease is positive sentiment.
  const sentiment = (() => {
    if (d.sign === 'neutral') return 'neutral';
    if (invert) return d.sign === 'positive' ? 'negative' : 'positive';
    return d.sign;
  })();

  const color =
    sentiment === 'positive'
      ? 'text-[var(--color-accent-positive)] bg-[var(--color-accent-positive-bg)]'
      : sentiment === 'negative'
      ? 'text-[var(--color-accent-negative)] bg-[var(--color-accent-negative-bg)]'
      : 'text-[var(--color-ink-tertiary)] bg-[var(--color-bg-elevated)]';

  const sizeCls = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-0.5',
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-[12px] px-2.5 py-1 gap-1',
  }[size];

  const iconSize = { xs: 10, sm: 10, md: 12 }[size];

  const Icon = d.direction === 'up' ? ArrowUp : d.direction === 'down' ? ArrowDown : Minus;

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full numeric',
        color,
        sizeCls,
        className
      )}
    >
      <Icon size={iconSize} strokeWidth={2.5} />
      {d.text}
    </span>
  );
}
