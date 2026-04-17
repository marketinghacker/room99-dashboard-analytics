'use client';

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

export function DashboardShell() {
  const tab = useTab((s) => s.tab);

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
