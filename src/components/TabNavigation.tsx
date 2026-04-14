'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TABS } from '@/lib/constants';

export default function TabNavigation() {
  const pathname = usePathname();

  // Derive the active tab from the pathname.
  // "/" maps to "executive-summary"; "/google-ads" maps to "google-ads", etc.
  const activeTab =
    pathname === '/'
      ? 'executive-summary'
      : pathname.replace(/^\//, '');

  return (
    <nav
      className="sticky z-40 bg-card border-b border-border overflow-x-auto"
      style={{ top: 49 }}
    >
      <div className="flex min-w-max px-4">
        {TABS.map((tab) => {
          const href = tab.id === 'executive-summary' ? '/' : `/${tab.id}`;
          const isActive = activeTab === tab.id;

          return (
            <Link
              key={tab.id}
              href={href}
              className={`
                relative px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors
                ${
                  isActive
                    ? 'text-primary'
                    : 'text-text-secondary hover:text-text'
                }
              `}
            >
              {tab.label}
              {/* Active indicator */}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
