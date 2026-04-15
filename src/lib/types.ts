/* ------------------------------------------------------------------ */
/*  Core metric types                                                  */
/* ------------------------------------------------------------------ */

export interface KPIMetric {
  label: string;
  value: number;
  previousValue?: number;
  change?: number;
  changeDirection?: 'up' | 'down' | 'neutral';
  format: 'currency' | 'percent' | 'number' | 'decimal';
}

export interface PlatformBudget {
  platform: string;
  spend: number;
  spendShare: number;
  momChange: number;
  revenue: number;
  roas: number;
  cpa: number;
  cr: number;
  roasChange: number;
}

export interface CampaignRow {
  name: string;
  spend: number;
  revenue: number;
  roas: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  cpc?: number;
  cr?: number;
  roasChange?: number;
  platform?: string;
  type?: string;
}

export interface FunnelStep {
  name: string;
  users: number;
  conversionRate: number;
  momChange: number;
}

export interface ChannelData {
  channel: string;
  sessions: number;
  addToCart: number;
  purchases: number;
  cr: number;
  revenue: number;
  crChange: number;
}

export interface ProductRow {
  name: string;
  category: string;
  sales?: number;
  revenue: number;
  revenueShare?: number;
  change?: number;
  trend?: number[];
}

/* ------------------------------------------------------------------ */
/*  Tab-level data envelope types                                      */
/* ------------------------------------------------------------------ */

export interface ExecutiveSummaryData {
  kpis: KPIMetric[];
  budgetByPlatform: PlatformBudget[];
  revenueByMonth?: Array<{ month: string; revenue: number; spend: number }>;
}

export interface PerformanceMarketingData {
  kpis: KPIMetric[];
  platformBreakdown: PlatformBudget[];
  topCampaigns: CampaignRow[];
}

export interface GoogleAdsData {
  kpis: KPIMetric[];
  campaigns: CampaignRow[];
  searchTerms?: Array<{ term: string; impressions: number; clicks: number; ctr: number; spend: number }>;
}

export interface MetaAdsData {
  kpis: KPIMetric[];
  campaigns: CampaignRow[];
  adSets?: CampaignRow[];
}

export interface PinterestAdsData {
  kpis: KPIMetric[];
  campaigns: CampaignRow[];
}

export interface CriteoData {
  kpis: KPIMetric[];
  campaigns: CampaignRow[];
}

export interface ProductCatalogsData {
  kpis: KPIMetric[];
  catalogs: Array<{
    name: string;
    platform: string;
    products: number;
    approved: number;
    rejected: number;
    pending: number;
    lastSync: string;
  }>;
}

export interface ConversionFunnelData {
  kpis: KPIMetric[];
  steps: FunnelStep[];
  funnelByDevice?: Array<{ device: string; steps: FunnelStep[] }>;
}

export interface TrafficSourcesData {
  kpis: KPIMetric[];
  channels: ChannelData[];
  sessionsBySource?: Array<{ source: string; sessions: number; share: number }>;
}

export interface TopProductsData {
  kpis: KPIMetric[];
  products: ProductRow[];
  categories?: Array<{ name: string; revenue: number; share: number; change: number }>;
}

/* ------------------------------------------------------------------ */
/*  Meta / shared types                                                */
/* ------------------------------------------------------------------ */

export interface DashboardMeta {
  lastUpdated: string;
  period: string;
  comparison: string;
}

export type TabId = (typeof import('./constants').TABS)[number]['id'];

/* ------------------------------------------------------------------ */
/*  API response types (v2)                                            */
/* ------------------------------------------------------------------ */

export interface ApiResponse<T> {
  data: T;
  lastUpdated: string;
  cached: boolean;
  alerts?: import('./alerts').Alert[];
}

export interface PlatformSpend {
  platform: 'google-ads' | 'meta-ads' | 'criteo' | 'pinterest';
  spend: number;
  revenue: number;
  roas: number;
  spendShare: number;
  change?: number;
}

export interface ExecutiveSummaryResponse {
  revenue: KPIMetric;
  aov: KPIMetric;
  cr: KPIMetric;
  transactions: KPIMetric;
  sessions: KPIMetric;
  marketing: {
    totalSpend: KPIMetric;
    costShare: KPIMetric;
    roas: KPIMetric;
  };
  platformSpend: PlatformSpend[];
  alerts: import('./alerts').Alert[];
}

export interface BaseLinkerResponse {
  revenue: number;
  orderCount: number;
  aov: number;
  products: Array<{
    sku: string;
    name: string;
    revenue: number;
    quantity: number;
    category: string;
    rootCategory: string;
  }>;
  categoryAggregates: Array<{
    category: string;
    revenue: number;
    quantity: number;
    productCount: number;
    share: number;
  }>;
}

export interface GA4Response {
  sessions: number;
  totalUsers: number;
  newUsers: number;
  engagementRate: number;
  avgSessionDuration: number;
  pageViews: number;
  ecommerce: {
    revenue: number;
    transactions: number;
    itemsPurchased: number;
    itemsViewed: number;
    itemsAddedToCart: number;
  };
  trafficSources: Array<{
    channel: string;
    sessions: number;
    share: number;
  }>;
  funnel?: FunnelStep[];
  dailyData?: Array<{
    date: string;
    sessions: number;
    revenue: number;
    transactions: number;
  }>;
}

export interface GoogleAdsResponse {
  totalSpend: number;
  totalConversions: number;
  totalConversionValue: number;
  roas: number;
  campaigns: CampaignRow[];
  shoppingProducts?: Array<{
    itemId: string;
    title: string;
    brand: string;
    productType: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
  }>;
}

export interface MetaAdsResponse {
  totalSpend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  revenue: number;
  roas: number;
  campaigns: CampaignRow[];
}

export interface CriteoResponse {
  totalSpend: number;
  clicks: number;
  displays: number;
  roas: number;
  campaigns: CampaignRow[];
}
