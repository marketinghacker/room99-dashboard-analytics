'use client';

import { useTab } from '@/stores/tab';
import { Header } from './Header';
import { TabNav } from './TabNav';
import { ExecutiveSummaryTab } from '@/components/tabs/ExecutiveSummary';
import { PerformanceMarketingTab } from '@/components/tabs/PerformanceMarketing';
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
      <Header />
      <TabNav />
      <div className="hairline max-w-[1440px] mx-auto" />
      <main className="max-w-[1440px] mx-auto px-8 py-8 pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          >
            {tab === 'executive-summary' && <ExecutiveSummaryTab />}
            {tab === 'performance-marketing' && <PerformanceMarketingTab />}
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
  );
}
