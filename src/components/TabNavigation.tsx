'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TABS } from '@/lib/constants';

export default function TabNavigation() {
  const pathname = usePathname();
  const activeTab = pathname === '/' ? 'executive-summary' : pathname.replace(/^\//, '');

  return (
    <nav className="sticky z-[99] bg-white border-b border-border overflow-x-auto" style={{ top: 49 }}>
      <div className="flex min-w-max px-6">
        {TABS.map((tab) => {
          const href = tab.id === 'executive-summary' ? '/' : `/${tab.id}`;
          const isActive = activeTab === tab.id;

          return (
            <Link
              key={tab.id}
              href={href}
              className={`
                px-5 py-3 text-[13px] font-medium whitespace-nowrap transition-all border-b-[3px]
                ${isActive
                  ? 'text-primary border-primary'
                  : 'text-text-secondary border-transparent hover:text-primary hover:bg-primary-light'
                }
              `}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
