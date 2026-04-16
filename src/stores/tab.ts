import { create } from 'zustand';

export type TabId =
  | 'executive-summary'
  | 'performance-marketing'
  | 'sales-channels'
  | 'google-ads'
  | 'meta-ads'
  | 'pinterest'
  | 'criteo'
  | 'product-catalogs'
  | 'funnel'
  | 'traffic-sources'
  | 'top-products';

type TabState = {
  tab: TabId;
  setTab: (t: TabId) => void;
};

export const useTab = create<TabState>((set) => ({
  tab: 'executive-summary',
  setTab: (tab) => set({ tab }),
}));
