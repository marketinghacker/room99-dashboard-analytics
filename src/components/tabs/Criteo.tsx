'use client';

import { PlatformTab } from './PlatformTab';

export function CriteoTab() {
  return (
    <PlatformTab
      endpoint="/api/data/criteo"
      platformLabel="Criteo"
      accountHint="Advertiser ID: 55483"
      accentColor="var(--color-platform-criteo)"
    />
  );
}
