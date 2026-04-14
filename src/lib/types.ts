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
