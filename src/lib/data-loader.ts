import fs from 'fs';
import path from 'path';
import type {
  DashboardMeta,
  ExecutiveSummaryData,
  PerformanceMarketingData,
  GoogleAdsData,
  MetaAdsData,
  PinterestAdsData,
  CriteoData,
  ProductCatalogsData,
  ConversionFunnelData,
  TrafficSourcesData,
  TopProductsData,
} from './types';

/**
 * Read and parse a JSON file from the `data/` directory at the project root.
 * Returns `null` when the file is missing or cannot be parsed.
 */
function readJsonFile<T>(filename: string): T | null {
  try {
    const filePath = path.join(process.cwd(), 'data', filename);
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Public loaders                                                     */
/* ------------------------------------------------------------------ */

export function loadMeta(): DashboardMeta | null {
  return readJsonFile<DashboardMeta>('_meta.json');
}

export function loadExecutiveSummary(): ExecutiveSummaryData | null {
  return readJsonFile<ExecutiveSummaryData>('executive-summary.json');
}

export function loadPerformanceMarketing(): PerformanceMarketingData | null {
  return readJsonFile<PerformanceMarketingData>('performance-marketing.json');
}

export function loadGoogleAds(): GoogleAdsData | null {
  return readJsonFile<GoogleAdsData>('google-ads.json');
}

export function loadMetaAds(): MetaAdsData | null {
  return readJsonFile<MetaAdsData>('meta-ads.json');
}

export function loadPinterestAds(): PinterestAdsData | null {
  return readJsonFile<PinterestAdsData>('pinterest-ads.json');
}

export function loadCriteo(): CriteoData | null {
  return readJsonFile<CriteoData>('criteo.json');
}

export function loadProductCatalogs(): ProductCatalogsData | null {
  return readJsonFile<ProductCatalogsData>('product-catalogs.json');
}

export function loadConversionFunnel(): ConversionFunnelData | null {
  return readJsonFile<ConversionFunnelData>('conversion-funnel.json');
}

export function loadTrafficSources(): TrafficSourcesData | null {
  return readJsonFile<TrafficSourcesData>('traffic-sources.json');
}

export function loadTopProducts(): TopProductsData | null {
  return readJsonFile<TopProductsData>('top-products.json');
}
