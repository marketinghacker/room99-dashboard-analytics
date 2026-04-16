'use client';

import { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

export function ChartCard({ title, subtitle, right, children, className, innerClassName }: Props) {
  return (
    <div className={cn('card p-5', className)}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[15px] font-semibold text-[var(--color-ink-primary)] leading-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-[12px] text-[var(--color-ink-tertiary)]">{subtitle}</p>
          )}
        </div>
        {right}
      </div>
      <div className={cn('relative', innerClassName)}>{children}</div>
    </div>
  );
}
