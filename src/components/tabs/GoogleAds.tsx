'use client';

import { PlatformTab } from './PlatformTab';

export function GoogleAdsTab() {
  return (
    <PlatformTab
      endpoint="/api/data/google-ads"
      platformLabel="Google Ads"
      accountHint="Customer ID: 1331139339 · Room99"
      accentColor="var(--color-platform-google)"
    />
  );
}
