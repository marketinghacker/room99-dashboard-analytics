'use client';

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useState } from 'react';
import { formatPLN, formatPLN2, formatInt, formatPct } from '@/lib/format';
import { DeltaBadge } from './DeltaBadge';
import { cn } from '@/components/ui/cn';

type Format = 'pln' | 'pln2' | 'int' | 'pct' | 'decimal';

type Props = {
  label: string;
  value: number | null | undefined;
  format: Format;
  delta?: number | null;
  /** When true, a decrease is a "good" delta (cos, cpc). */
  deltaInverted?: boolean;
  sublabel?: string;
  /** Suppress the count-up animation (for above-the-fold nav back and forth). */
  animate?: boolean;
  className?: string;
  tone?: 'default' | 'primary';
};

function fmt(v: number | null | undefined, f: Format): string {
  if (v == null || !Number.isFinite(v)) return '—';
  switch (f) {
    case 'pln':
      return formatPLN(v);
    case 'pln2':
      return formatPLN2(v);
    case 'int':
      return formatInt(v);
    case 'pct':
      return formatPct(v);
    case 'decimal':
      return new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v).replace(/\u00A0|\u202F/g, ' ');
  }
}

export function HeroMetric({
  label,
  value,
  format,
  delta,
  deltaInverted,
  sublabel,
  animate: doAnimate = true,
  className,
  tone = 'default',
}: Props) {
  const [display, setDisplay] = useState<string>(fmt(value, format));

  useEffect(() => {
    if (value == null || !Number.isFinite(value)) {
      setDisplay('—');
      return;
    }
    if (!doAnimate) {
      setDisplay(fmt(value, format));
      return;
    }
    const mv = { v: 0 };
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.32, 0.72, 0, 1],
      onUpdate: (val) => setDisplay(fmt(val, format)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, format, doAnimate]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      className={cn(
        'card card-hover relative overflow-hidden p-6 min-h-[148px]',
        tone === 'primary' && 'bg-glow-blue',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="overline">{label}</span>
        {delta != null && <DeltaBadge pct={delta} invert={deltaInverted} />}
      </div>

      <div
        className="mt-3 hero-numeral leading-[1.05] text-[var(--color-ink-primary)] tabular whitespace-nowrap overflow-hidden text-ellipsis"
        style={{ fontSize: 'clamp(22px, 2.6vw, 40px)' }}
        title={display}
      >
        {display}
      </div>

      {sublabel && (
        <div className="mt-2 text-[12px] text-[var(--color-ink-tertiary)]">{sublabel}</div>
      )}
    </motion.div>
  );
}
