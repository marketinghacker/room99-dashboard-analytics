'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { cn } from '@/components/ui/cn';
import { FilterBar } from './FilterBar';

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 20);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-30 transition-all duration-300',
        scrolled ? 'backdrop-blur-header' : 'bg-transparent'
      )}
    >
      <div className="max-w-[1440px] mx-auto px-8 py-4 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-[10px] overflow-hidden ring-1 ring-[var(--color-border-subtle)] bg-white">
            <Image src="/brand/room99-logo.png" alt="Room99" fill sizes="36px" className="object-contain p-1" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] font-semibold text-[var(--color-accent-primary)] tracking-[0.08em] uppercase">
              Room99
            </span>
            <h1 className="text-[15px] font-semibold text-[var(--color-ink-primary)]">
              Performance Dashboard
            </h1>
          </div>
        </div>

        <div className="ml-auto flex-1 max-w-[880px]">
          <FilterBar />
        </div>
      </div>
    </header>
  );
}
