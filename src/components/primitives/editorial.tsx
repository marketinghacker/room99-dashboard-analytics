'use client';

/**
 * Editorial primitives — atoms + composites used across all tabs.
 * Designed for the warm magazine aesthetic: Fraunces H-weights, mono
 * overlines, terracotta/sage accents, tabular numerals.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatPLN, formatInt, formatPct } from '@/lib/format';

/* ---------- formatters (Polish, editorial tone) ---------- */

export function fmtPLNCompact(n: number | null | undefined): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return (n / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2).replace('.', ',') + ' mln zł';
  }
  if (abs >= 10_000) return Math.round(n / 1000).toLocaleString('pl-PL') + ' tys. zł';
  return formatPLN(n);
}

export function fmtX(n: number | null | undefined, digits = 2): string {
  return n == null ? '—' : `${n.toFixed(digits).replace('.', ',')}×`;
}

/* ---------- count-up hook ---------- */

/**
 * Easing count-up from 0 → target using requestAnimationFrame.
 * Honours `prefers-reduced-motion` — returns the target immediately.
 */
export function useCountUp(target: number | null | undefined, duration = 1400): number {
  const [val, setVal] = useState(0);
  const prevTarget = useRef<number | null>(null);

  useEffect(() => {
    if (target == null) {
      setVal(0);
      return;
    }
    if (prevTarget.current === target) return;
    prevTarget.current = target;

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(target);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      // cubic-bezier(0.32, 0.72, 0, 1) approximation — strong start, gentle finish
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return val;
}

/* ---------- Overline ---------- */

export function Overline({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`overline ${className}`}>{children}</div>;
}

/* ---------- Dot (platform color indicator) ---------- */

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{ background: color, width: size, height: size }}
    />
  );
}

export const PLATFORM_DOT: Record<string, string> = {
  meta:      'var(--color-platform-meta)',
  google:    'var(--color-platform-google)',
  google_ads:'var(--color-platform-google)',
  pinterest: 'var(--color-platform-pinterest)',
  criteo:    'var(--color-platform-criteo)',
  ga4:       'var(--color-platform-ga4)',
  shr:       'var(--color-accent-2)',
  allegro:   'var(--color-accent)',
};

/* ---------- Delta badge ---------- */

export function Delta({
  value,
  inverted = false,
  size = 'sm',
}: {
  value: number | null | undefined;
  /** Invert color meaning (e.g. for cost metrics where +% = bad) */
  inverted?: boolean;
  size?: 'xs' | 'sm' | 'lg';
}) {
  if (value == null) return <span style={{ color: 'var(--color-ink-tertiary)' }}>—</span>;
  const isUp = value > 0;
  const good = inverted ? !isUp : isUp;
  const arrow = isUp ? '↑' : '↓';
  const color = good ? 'var(--color-accent-positive)' : 'var(--color-accent-negative)';
  const bg = good ? 'var(--color-accent-positive-bg)' : 'var(--color-accent-negative-bg)';
  const fontSize = size === 'lg' ? 14 : size === 'xs' ? 10 : 12;
  const padY = size === 'lg' ? 4 : 2;
  const padX = size === 'lg' ? 10 : size === 'xs' ? 5 : 7;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-medium numeric"
      style={{
        color,
        background: bg,
        fontSize,
        padding: `${padY}px ${padX}px`,
        border: `1px solid color-mix(in oklch, ${color} 24%, transparent)`,
      }}
    >
      <span>{arrow}</span>
      <span>
        {isUp ? '+' : ''}
        {Math.abs(value * 100).toFixed(1).replace('.', ',')}%
      </span>
    </span>
  );
}

/* ---------- Sparkline ---------- */

export function Sparkline({
  data,
  width = 88,
  height = 24,
  color = 'var(--color-accent-2)',
  filled = true,
  strokeWidth = 1.25,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  filled?: boolean;
  strokeWidth?: number;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map<[number, number]>((v, i) => [
    i * step,
    height - ((v - min) / range) * (height - 4) - 2,
  ]);
  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = filled ? d + ` L${width},${height} L0,${height} Z` : null;
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', display: 'block' }}>
      {filled && area && <path d={area} fill={color} opacity={0.1} />}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2} fill={color} />
    </svg>
  );
}

/* ---------- Bar (inline progress) ---------- */

export function Bar({
  pct,
  color = 'var(--color-accent)',
  background = 'var(--color-line-soft)',
  width = 120,
  height = 4,
}: {
  pct: number; // 0..1
  color?: string;
  background?: string;
  width?: number;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <span
      className="relative inline-block rounded-full overflow-hidden align-middle"
      style={{ width, height, background }}
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: color, width: `${clamped * 100}%`, transition: 'width 600ms cubic-bezier(0.32, 0.72, 0, 1)' }}
      />
    </span>
  );
}

/* ---------- Chip ---------- */

export function Chip({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'pos' | 'warn' | 'neg';
  className?: string;
}) {
  const cls = tone === 'pos' ? 'chip-pos' : tone === 'warn' ? 'chip-warn' : tone === 'neg' ? 'chip-neg' : '';
  return <span className={`chip ${cls} ${className}`}>{children}</span>;
}

/* ---------- SectionHead ---------- */

export function SectionHead({
  number,
  title,
  sub,
  right,
}: {
  number: string; // e.g. "§01"
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <div className="flex items-baseline gap-3">
          <span
            className="font-mono text-[11px] tracking-[0.12em]"
            style={{ color: 'var(--color-accent)' }}
          >
            {number}
          </span>
          <h2 className="section-title">{title}</h2>
        </div>
        {sub && (
          <p
            className="mt-0.5 text-[13px]"
            style={{ color: 'var(--color-ink-secondary)', fontFamily: 'var(--font-text)' }}
          >
            {sub}
          </p>
        )}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

/* ---------- Masthead ---------- */

export function Masthead({
  kicker,
  title,
  lede,
  className = '',
}: {
  kicker: string;           // "№ 03 · Marzec 2026 · Monthly Review"
  title?: ReactNode;         // serif H1 — may contain <em>; optional
  lede?: ReactNode;          // optional subhead paragraph
  className?: string;
}) {
  // Render H1 only when a non-empty title is provided. Empty string is a
  // common default ("no headline by default, agency can add one").
  const hasTitle = !!title && (typeof title !== 'string' || title.trim().length > 0);
  return (
    <header className={`mb-8 ${className}`}>
      <div className="overline mb-4">{kicker}</div>
      {hasTitle && <h1 className="masthead-h1">{title}</h1>}
      {lede && <p className={`lede ${hasTitle ? 'mt-5' : 'mt-2'}`}>{lede}</p>}
    </header>
  );
}

/* ---------- HeroKpi (big magazine-style KPI card) ---------- */

export function HeroKpi({
  label,
  value,
  change,
  format = 'pln',
  primary = false,
  hint,
}: {
  label: string;
  value: number;
  change?: number | null;
  format?: 'pln' | 'int' | 'pct' | 'x';
  primary?: boolean;
  hint?: string;
}) {
  const count = useCountUp(value, 1400);
  const display =
    format === 'pln' ? formatPLN(Math.round(count))
      : format === 'int' ? formatInt(Math.round(count))
      : format === 'pct' ? formatPct(count / 100)
      : fmtX(count);

  return (
    <div
      className={primary ? 'card-hero p-6' : 'card card-hover p-6'}
      style={primary ? {} : {}}
    >
      <div className="flex items-center justify-between mb-2">
        <Overline>{label}</Overline>
        {change != null && <Delta value={change / 100} />}
      </div>
      <div
        className="hero-numeral break-words"
        style={{
          // Fluid sizing so million-złoty values with 2 decimals fit without
          // clipping. Allow wrap on very narrow widths rather than truncate.
          fontSize: primary ? 'clamp(24px, 3vw, 42px)' : 'clamp(20px, 2.2vw, 32px)',
          lineHeight: 1.1,
          color: 'var(--color-ink-primary)',
          letterSpacing: '-0.035em',
        }}
      >
        {display}
      </div>
      {hint && (
        <div
          className="mt-2 text-[11px]"
          style={{ color: 'var(--color-ink-tertiary)' }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

/* ---------- StatCard (compact KPI cell in 6-col strip) ---------- */

export function StatCard({
  label,
  value,
  change,
  format = 'int',
  trend,
}: {
  label: string;
  value: number;
  change?: number | null;
  format?: 'pln' | 'int' | 'pct' | 'x';
  trend?: number[];
}) {
  const count = useCountUp(value, 1400);
  const display =
    format === 'pln' ? formatPLN(Math.round(count))
      : format === 'int' ? formatInt(Math.round(count))
      : format === 'pct' ? formatPct(count / 100)
      : fmtX(count);

  return (
    <div
      className="flex flex-col gap-1 p-3 rounded-[8px]"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-line-soft)' }}
    >
      <Overline>{label}</Overline>
      <div
        className="numeric break-words"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 'clamp(16px, 1.6vw, 22px)',
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
          color: 'var(--color-ink-primary)',
        }}
        title={display}
      >
        {display}
      </div>
      <div className="flex items-center justify-between mt-0.5">
        {change != null ? <Delta value={change / 100} size="xs" /> : <span />}
        {trend && trend.length > 1 && (
          <Sparkline data={trend} width={72} height={18} color="var(--color-accent-2)" strokeWidth={1} />
        )}
      </div>
    </div>
  );
}

/* ---------- CompareBar (Shoper vs Allegro style two-up) ---------- */

export function CompareBar({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  format = 'pln',
}: {
  leftLabel: string;
  leftValue: number;
  rightLabel: string;
  rightValue: number;
  format?: 'pln' | 'int';
}) {
  const total = leftValue + rightValue || 1;
  const leftPct = leftValue / total;
  const leftWins = leftValue > rightValue;
  const fmt = (n: number) => (format === 'pln' ? formatPLN(n) : formatInt(n));

  return (
    <div className="card p-6">
      <div className="flex gap-6 items-center">
        <div className="flex-1">
          <Overline>{leftLabel}</Overline>
          <div
            className="hero-numeral mt-1"
            style={{
              fontSize: 36,
              color: leftWins ? 'var(--color-accent)' : 'var(--color-ink-primary)',
            }}
          >
            {fmt(leftValue)}
          </div>
        </div>
        <div
          className="w-px self-stretch"
          style={{ background: 'var(--color-line-soft)' }}
        />
        <div className="flex-1 text-right">
          <Overline>{rightLabel}</Overline>
          <div
            className="hero-numeral mt-1"
            style={{
              fontSize: 36,
              color: !leftWins ? 'var(--color-accent)' : 'var(--color-ink-primary)',
            }}
          >
            {fmt(rightValue)}
          </div>
        </div>
      </div>
      {/* Stacked bar */}
      <div
        className="mt-4 h-2 rounded-full overflow-hidden flex"
        style={{ background: 'var(--color-line-soft)' }}
      >
        <div
          style={{
            width: `${leftPct * 100}%`,
            background: 'var(--color-accent)',
            transition: 'width 600ms cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        />
        <div
          style={{
            width: `${(1 - leftPct) * 100}%`,
            background: 'var(--color-accent-2)',
            transition: 'width 600ms cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[11px]" style={{ color: 'var(--color-ink-tertiary)' }}>
        <span>{(leftPct * 100).toFixed(0).replace('.', ',')}%</span>
        <span>{((1 - leftPct) * 100).toFixed(0).replace('.', ',')}%</span>
      </div>
    </div>
  );
}
