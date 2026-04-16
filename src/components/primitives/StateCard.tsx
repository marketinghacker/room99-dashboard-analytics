'use client';

import { cn } from '@/components/ui/cn';
import { AlertCircle, Loader2 } from 'lucide-react';

export function LoadingCard({ className, minHeight = 180 }: { className?: string; minHeight?: number }) {
  return (
    <div
      className={cn('card p-6 flex flex-col items-center justify-center gap-3 text-[var(--color-ink-tertiary)]', className)}
      style={{ minHeight }}
    >
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-[13px]">Ładowanie danych…</span>
    </div>
  );
}

export function ErrorCard({ error, className, onRetry }: { error?: string; className?: string; onRetry?: () => void }) {
  return (
    <div className={cn('card p-6 flex items-start gap-3 border-[var(--color-accent-negative)]/30', className)}>
      <AlertCircle className="w-4 h-4 text-[var(--color-accent-negative)] mt-0.5 shrink-0" />
      <div className="flex-1">
        <div className="text-[13px] font-semibold text-[var(--color-ink-primary)]">Nie udało się wczytać danych</div>
        {error && <div className="mt-1 text-[12px] text-[var(--color-ink-tertiary)]">{error}</div>}
        <div className="mt-2 text-[12px] text-[var(--color-ink-secondary)]">
          Spróbuj odświeżyć lub uruchom sync: <code className="font-mono">GET /api/cron/sync?key=…</code>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-[12px] font-semibold text-[var(--color-accent-primary)] hover:underline"
        >
          Ponów
        </button>
      )}
    </div>
  );
}

export function EmptyCard({ title, subtitle, className }: { title: string; subtitle?: string; className?: string }) {
  return (
    <div className={cn('card p-8 text-center', className)}>
      <div className="text-[14px] font-semibold text-[var(--color-ink-primary)]">{title}</div>
      {subtitle && <div className="mt-1 text-[12px] text-[var(--color-ink-tertiary)]">{subtitle}</div>}
    </div>
  );
}
