/**
 * Tab → sync-source mapping. Used by:
 *   - RefreshDataModal (defaults its checkboxes from this)
 *   - SyncStatus (fetches the heartbeat and considers only sources for the
 *     currently-active tab when deciding the freshness color)
 *
 * This is the single source of truth for "what data does this tab depend on".
 * If a new tab is added, extend TabId AND this map — the test in
 * tab-source-mapping.test.ts asserts every TabId has a non-empty list.
 */
import type { TabId } from '@/stores/tab';

export type SyncSource =
  | 'meta'
  | 'google_ads'
  | 'criteo'
  | 'ga4'
  | 'pinterest'
  | 'sellrocket'
  | 'products';

/** All known sync sources, in canonical UI order. */
export const ALL_SOURCES: readonly SyncSource[] = [
  'meta',
  'google_ads',
  'criteo',
  'ga4',
  'pinterest',
  'sellrocket',
  'products',
] as const;

/** Polish display labels for the modal checkboxes / status tooltip. */
export const SOURCE_LABEL: Record<SyncSource, string> = {
  meta: 'Meta Ads',
  google_ads: 'Google Ads',
  criteo: 'Criteo',
  ga4: 'GA4',
  pinterest: 'Pinterest',
  sellrocket: 'SellRocket / Allegro',
  products: 'Produkty (Shoper + BaseLinker)',
};

/**
 * Per-tab default source pre-selection. Executive summary depends on
 * everything, so it defaults to all sources; platform tabs default to just
 * their own source. Order within each list is irrelevant (UI rebuilds
 * checkbox order from ALL_SOURCES).
 */
export const TAB_SOURCES: Record<TabId, readonly SyncSource[]> = {
  'executive-summary':     ALL_SOURCES,
  'performance-marketing': ['meta', 'google_ads', 'criteo', 'pinterest'],
  'sales-channels':        ['sellrocket'],
  'sales-tree':            ['sellrocket', 'products'],
  'google-ads':            ['google_ads'],
  'meta-ads':              ['meta'],
  pinterest:               ['pinterest'],
  criteo:                  ['criteo'],
  'product-catalogs':      ['products'],
  'traffic-sources':       ['ga4'],
  'top-products':          ['sellrocket', 'products'],
};

/**
 * Returns true if any of the given sources are BaseLinker-backed (Allegro
 * orders confirm 12-48h after purchase). Surface this in the SyncStatus
 * tooltip so the user understands why recent days look low even when a
 * sync just succeeded.
 */
export function dependsOnAllegro(sources: readonly string[]): boolean {
  return sources.some((s) => s === 'sellrocket' || s === 'products');
}
