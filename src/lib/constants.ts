export const GA4_PROPERTY_ID = '315856757';
export const META_ACCOUNT_ID = 'act_1182539112713219';
export const CRITEO_ADVERTISER_ID = '55483';

export const PLATFORM_COLORS = {
  google: { bg: '#e8f0fe', text: '#4285f4' },
  meta: { bg: '#e7f0ff', text: '#0668E1' },
  pinterest: { bg: '#fce8ec', text: '#E60023' },
  criteo: { bg: '#fff3e0', text: '#ff6b35' },
} as const;

export const TABS = [
  { id: 'executive-summary', label: 'Executive Summary' },
  { id: 'performance-marketing', label: 'Performance Marketing' },
  { id: 'google-ads', label: 'Google Ads' },
  { id: 'meta-ads', label: 'Meta Ads' },
  { id: 'pinterest-ads', label: 'Pinterest Ads' },
  { id: 'criteo', label: 'Criteo' },
  { id: 'product-catalogs', label: 'Katalogi Produktowe' },
  { id: 'conversion-funnel', label: 'Lejek Konwersji' },
  { id: 'traffic-sources', label: 'Źródła Ruchu (GA4)' },
  { id: 'top-products', label: 'TOP Produkty' },
] as const;
