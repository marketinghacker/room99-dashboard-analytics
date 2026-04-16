'use client';

import { PlatformTab } from './PlatformTab';

export function MetaAdsTab() {
  return (
    <PlatformTab
      endpoint="/api/data/meta-ads"
      platformLabel="Meta Ads"
      accountHint="Konto: act_295812916 · Room99"
      accentColor="var(--color-platform-meta)"
    />
  );
}
