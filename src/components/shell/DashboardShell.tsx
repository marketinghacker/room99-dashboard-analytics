'use client';

import { useEffect, useState } from 'react';
import { useTab } from '@/stores/tab';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { AgencyStrip } from './AgencyStrip';
import { RoleHydrator } from './RoleHydrator';
import { ExecutiveSummaryTab } from '@/components/tabs/ExecutiveSummary';
import { PerformanceMarketingTab } from '@/components/tabs/PerformanceMarketing';
import { SalesChannelsTab } from '@/components/tabs/SalesChannels';
import { GoogleAdsTab } from '@/components/tabs/GoogleAds';
import { MetaAdsTab } from '@/components/tabs/MetaAds';
import { PinterestTab } from '@/components/tabs/Pinterest';
import { CriteoTab } from '@/components/tabs/Criteo';
import { ProductCatalogsTab } from '@/components/tabs/ProductCatalogs';
import { FunnelTab } from '@/components/tabs/Funnel';
import { TrafficSourcesTab } from '@/components/tabs/TrafficSources';
import { TopProductsTab } from '@/components/tabs/TopProducts';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Skip the first render entirely, so client content never has to match
 * server-rendered HTML. Fixes hydration mismatches coming from
 *  - new Date() in render,
 *  - pl-PL locale-dependent date formatting (differs between Node + browser),
 *  - zustand persist rehydrate,
 * without the dynamic(ssr:false) approach which code-split zustand into two
 * module instances (tab state got stuck).
 */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function DashboardShell() {
  const tab = useTab((s) => s.tab);
  const mounted = useMounted();

  if (!mounted) {
    return (
      <div className="min-h-screen">
        <div
          className="fixed top-0 left-0 bottom-0 w-[260px]"
          style={{ background: 'var(--color-bg-side)', borderRight: '1px solid var(--color-line-soft)' }}
        />
        <div className="pl-[260px]">
          <div className="h-14" style={{ background: 'var(--color-bg-base)', borderBottom: '1px solid var(--color-line-soft)' }} />
          <main style={{ padding: '28px 40px 80px' }} className="max-w-[1440px] mx-auto">
            <div className="skeleton h-[32px] w-[260px] mb-3" />
            <div className="skeleton h-[96px] w-full" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <RoleHydrator />
      <Sidebar />

      {/* Main column — offset by the 260px sidebar */}
      <div className="pl-[260px]">
        <Topbar />
        <AgencyStrip />

        <main
          className="max-w-[1440px] mx-auto"
          style={{ padding: '28px 40px 80px' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            >
              {tab === 'executive-summary' && <ExecutiveSummaryTab />}
              {tab === 'performance-marketing' && <PerformanceMarketingTab />}
              {tab === 'sales-channels' && <SalesChannelsTab />}
              {tab === 'google-ads' && <GoogleAdsTab />}
              {tab === 'meta-ads' && <MetaAdsTab />}
              {tab === 'pinterest' && <PinterestTab />}
              {tab === 'criteo' && <CriteoTab />}
              {tab === 'product-catalogs' && <ProductCatalogsTab />}
              {tab === 'funnel' && <FunnelTab />}
              {tab === 'traffic-sources' && <TrafficSourcesTab />}
              {tab === 'top-products' && <TopProductsTab />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
