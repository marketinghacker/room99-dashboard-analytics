'use client';

import { PlatformTab } from './PlatformTab';

export function PinterestTab() {
  return (
    <PlatformTab
      endpoint="/api/data/pinterest"
      platformLabel="Pinterest"
      accountHint="Konto: 549764456968 · Room99"
      accentColor="var(--color-platform-pinterest)"
    />
  );
}
