'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from './cn';
import { ChevronDown, Check } from 'lucide-react';

export type SelectOption = {
  value: string;
  label: string;
  hint?: string;
};

type Props = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  label?: string;
  className?: string;
};

export function Select({ value, options, onChange, label, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div ref={ref} className={cn('relative', className)}>
      {label && (
        <span className="overline block mb-1.5">{label}</span>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-3.5 py-2 h-9',
          'bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)]',
          'rounded-[10px] text-[13px] font-medium text-[var(--color-ink-primary)]',
          'hover:border-[var(--color-border-strong)] transition-colors',
          'cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]',
          open && 'border-[var(--color-accent-primary)] ring-2 ring-[var(--color-accent-primary)]/15'
        )}
      >
        <span className="truncate">{current?.label ?? 'Wybierz'}</span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-[var(--color-ink-tertiary)] transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-40 mt-1.5 w-full min-w-[220px] max-h-[360px] overflow-auto',
            'bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)]',
            'rounded-[12px] p-1 shadow-[var(--shadow-popover)]',
            'animate-fade-in'
          )}
          role="listbox"
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[8px]',
                  'text-[13px] text-left transition-colors',
                  'hover:bg-[var(--color-bg-elevated)]',
                  selected && 'bg-[var(--color-bg-elevated)]'
                )}
              >
                <div className="flex flex-col">
                  <span className="font-medium text-[var(--color-ink-primary)]">{o.label}</span>
                  {o.hint && (
                    <span className="text-[11px] text-[var(--color-ink-tertiary)] numeric">
                      {o.hint}
                    </span>
                  )}
                </div>
                {selected && <Check className="w-3.5 h-3.5 text-[var(--color-accent-primary)]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
