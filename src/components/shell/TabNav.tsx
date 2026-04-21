'use client';

import { useTab, type TabId } from '@/stores/tab';
import { cn } from '@/components/ui/cn';
import { motion, LayoutGroup } from 'framer-motion';

type TabDef = { id: TabId; label: string; short?: string };

const TABS: TabDef[] = [
  { id: 'executive-summary', label: 'Podsumowanie' },
  { id: 'performance-marketing', label: 'Performance' },
  { id: 'sales-channels', label: 'Kanały' },
  { id: 'google-ads', label: 'Google Ads' },
  { id: 'meta-ads', label: 'Meta Ads' },
  { id: 'pinterest', label: 'Pinterest' },
  { id: 'criteo', label: 'Criteo' },
  { id: 'product-catalogs', label: 'Katalogi' },
  { id: 'traffic-sources', label: 'Ruch' },
  { id: 'top-products', label: 'Produkty' },
];

export function TabNav() {
  const { tab, setTab } = useTab();

  return (
    <nav className="max-w-[1440px] mx-auto px-8 pt-2 pb-3">
      <LayoutGroup id="tabnav">
        <div className="inline-flex items-center gap-1 p-1 rounded-[14px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                data-tab={t.id}
                className={cn(
                  'relative px-3.5 py-1.5 rounded-[10px] text-[13px] font-medium transition-colors z-[1]',
                  active
                    ? 'text-[var(--color-ink-primary)]'
                    : 'text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)]'
                )}
              >
                {active && (
                  <motion.span
                    layoutId="tab-active-pill"
                    className="absolute inset-0 rounded-[10px] bg-[var(--color-bg-card)] shadow-[var(--shadow-card)] -z-[1]"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>
    </nav>
  );
}
