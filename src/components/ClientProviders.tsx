'use client';

import type { ReactNode } from 'react';
import { DateRangeProvider } from '@/contexts/DateRangeContext';

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <DateRangeProvider defaultPreset="this_month">
      {children}
    </DateRangeProvider>
  );
}
