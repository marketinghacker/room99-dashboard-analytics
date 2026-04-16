'use client';

import { cn } from '@/components/ui/cn';

const STYLES: Record<string, { bg: string; color: string; label: string }> = {
  meta: { bg: 'rgba(6, 104, 225, 0.10)', color: 'var(--color-platform-meta)', label: 'Meta' },
  google_ads: { bg: 'rgba(66, 133, 244, 0.10)', color: 'var(--color-platform-google)', label: 'Google' },
  pinterest: { bg: 'rgba(230, 0, 35, 0.08)', color: 'var(--color-platform-pinterest)', label: 'Pinterest' },
  criteo: { bg: 'rgba(255, 107, 53, 0.10)', color: 'var(--color-platform-criteo)', label: 'Criteo' },
  ga4: { bg: 'rgba(245, 130, 32, 0.10)', color: 'var(--color-platform-ga4)', label: 'GA4' },
  all: { bg: 'var(--color-bg-elevated)', color: 'var(--color-ink-secondary)', label: 'Wszystkie' },
};

export function PlatformBadge({ platform, className }: { platform: string; className?: string }) {
  const s = STYLES[platform] ?? STYLES.all;
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold', className)}
      style={{ background: s.bg, color: s.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}
