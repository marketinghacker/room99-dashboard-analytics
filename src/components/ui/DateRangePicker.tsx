'use client';

import { useState, useEffect, useRef } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from './cn';

export function rangeToPeriodKey(range: { from: Date; to: Date }): string {
  return `custom_${format(range.from, 'yyyy-MM-dd')}_${format(range.to, 'yyyy-MM-dd')}`;
}

function parseUTCDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(date.getTime())) return null;
  // Validate round-trip — rejects e.g. 2026-02-31.
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

export function periodKeyToRange(key: string): DateRange | undefined {
  const m = /^custom_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(key);
  if (!m) return undefined;
  const from = parseUTCDate(m[1]);
  const to = parseUTCDate(m[2]);
  if (!from || !to) return undefined;
  return { from, to };
}

type Props = {
  /** Fired as soon as both `from` and `to` are picked — with a `custom_` key. */
  onSelect: (periodKey: string) => void;
  /** Initial range (derived by caller from the current period key if custom). */
  initial?: DateRange;
  /** Close callback (e.g. to dismiss a popover). */
  onClose?: () => void;
};

export function DateRangePicker({ onSelect, initial, onClose }: Props) {
  const [range, setRange] = useState<DateRange | undefined>(initial);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onClose) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={cn(
        'p-3 rounded-[14px] bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)]',
        'shadow-[var(--shadow-popover)]'
      )}
    >
      <DayPicker
        mode="range"
        selected={range}
        onSelect={(r) => {
          setRange(r);
          if (r?.from && r?.to) {
            onSelect(rangeToPeriodKey({ from: r.from, to: r.to }));
          }
        }}
        locale={pl}
        numberOfMonths={2}
        weekStartsOn={1}
        captionLayout="dropdown"
        fromYear={2024}
        toYear={new Date().getFullYear() + 1}
      />
      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[var(--color-border-subtle)]">
        <span className="text-[11px] text-[var(--color-ink-tertiary)] numeric">
          {range?.from && range?.to
            ? `${format(range.from, 'yyyy-MM-dd')} → ${format(range.to, 'yyyy-MM-dd')}`
            : 'Wybierz początek i koniec'}
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[12px] px-2 py-1 rounded-md hover:bg-[var(--color-bg-elevated)]"
          >
            Zamknij
          </button>
        )}
      </div>
    </div>
  );
}
