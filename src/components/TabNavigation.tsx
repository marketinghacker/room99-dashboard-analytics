'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TABS } from '@/lib/constants';

export default function TabNavigation() {
  const pathname = usePathname();
  const activeTab = pathname === '/' ? 'executive-summary' : pathname.replace(/^\//, '');

  return (
    <nav className="sticky z-40 border-b border-glass-border bg-bg/50 backdrop-blur-xl overflow-x-auto" style={{ top: 52 }}>
      <div className="max-w-[1400px] mx-auto flex min-w-max px-6">
        {TABS.map((tab) => {
          const href = tab.id === 'executive-summary' ? '/' : `/${tab.id}`;
          const isActive = activeTab === tab.id;

          return (
            <Link
              key={tab.id}
              href={href}
              className={`
                relative px-4 py-3 text-[12px] font-medium whitespace-nowrap transition-all duration-200
                ${isActive
                  ? 'text-accent'
                  : 'text-text-muted hover:text-text-secondary'
                }
              `}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-accent/80 to-accent rounded-t-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
