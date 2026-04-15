'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TABS } from '@/lib/constants';

export default function TabNavigation() {
  const pathname = usePathname();
  const activeTab = pathname === '/' ? 'executive-summary' : pathname.replace(/^\//, '');

  return (
    <nav className="sticky z-40 bg-card/60 backdrop-blur-md border-b border-border overflow-x-auto" style={{ top: 48 }}>
      <div className="max-w-[1280px] mx-auto flex min-w-max px-5">
        {TABS.map((tab) => {
          const href = tab.id === 'executive-summary' ? '/' : `/${tab.id}`;
          const isActive = activeTab === tab.id;

          return (
            <Link
              key={tab.id}
              href={href}
              className={`
                relative px-3.5 py-2.5 text-[12px] font-medium whitespace-nowrap transition-colors
                ${isActive
                  ? 'text-accent font-semibold'
                  : 'text-text-muted hover:text-text-secondary'
                }
              `}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-1.5 right-1.5 h-[2px] bg-accent rounded-t-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
