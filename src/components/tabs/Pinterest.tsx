'use client';

import { PlatformTab } from './PlatformTab';
import { useFilters } from '@/stores/filters';
import { resolvePeriod } from '@/lib/periods';

export function PinterestTab() {
  const { period } = useFilters();
  const range = resolvePeriod(period);
  const days = Math.round(
    (new Date(range.end).getTime() - new Date(range.start).getTime()) / 86_400_000
  ) + 1;
  const showWarning = days > 30;

  return (
    <PlatformTab
      endpoint="/api/data/pinterest"
      platformLabel="Pinterest"
      accountHint="Windsor.ai · Room99 sp. z o.o."
      accentColor="var(--color-platform-pinterest)"
      warningBanner={
        showWarning
          ? 'Pinterest ograniczony do 30 dni (Windsor cache). Wybierz krótszy zakres żeby widzieć pełne dane.'
          : null
      }
    />
  );
}
