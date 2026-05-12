import { describe, it, expect } from 'vitest';
import { TAB_SOURCES, ALL_SOURCES, SOURCE_LABEL, dependsOnAllegro } from './tab-source-mapping';
import type { TabId } from '@/stores/tab';

const ALL_TABS: TabId[] = [
  'executive-summary',
  'performance-marketing',
  'sales-channels',
  'sales-tree',
  'google-ads',
  'meta-ads',
  'pinterest',
  'criteo',
  'product-catalogs',
  'traffic-sources',
  'top-products',
];

describe('TAB_SOURCES', () => {
  it('every TabId maps to a non-empty source list', () => {
    for (const t of ALL_TABS) {
      const sources = TAB_SOURCES[t];
      expect(sources, `${t} should have sources`).toBeDefined();
      expect(sources.length, `${t} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it('uses only known SyncSource values', () => {
    const valid = new Set<string>(ALL_SOURCES);
    for (const t of ALL_TABS) {
      for (const s of TAB_SOURCES[t]) {
        expect(valid.has(s), `${t}: unknown source ${s}`).toBe(true);
      }
    }
  });

  it('platform tabs map to their own source only', () => {
    expect(TAB_SOURCES['google-ads']).toEqual(['google_ads']);
    expect(TAB_SOURCES['meta-ads']).toEqual(['meta']);
    expect(TAB_SOURCES.pinterest).toEqual(['pinterest']);
    expect(TAB_SOURCES.criteo).toEqual(['criteo']);
    expect(TAB_SOURCES['traffic-sources']).toEqual(['ga4']);
  });

  it('executive-summary spans all sources', () => {
    expect(TAB_SOURCES['executive-summary']).toEqual(ALL_SOURCES);
  });

  it('sales tabs include sellrocket', () => {
    expect(TAB_SOURCES['sales-channels']).toContain('sellrocket');
    expect(TAB_SOURCES['sales-tree']).toContain('sellrocket');
    expect(TAB_SOURCES['top-products']).toContain('sellrocket');
  });
});

describe('SOURCE_LABEL', () => {
  it('every source has a Polish label', () => {
    for (const s of ALL_SOURCES) {
      expect(SOURCE_LABEL[s]).toBeTruthy();
      expect(typeof SOURCE_LABEL[s]).toBe('string');
    }
  });
});

describe('dependsOnAllegro', () => {
  it('true when sellrocket present', () => {
    expect(dependsOnAllegro(['sellrocket'])).toBe(true);
    expect(dependsOnAllegro(['meta', 'sellrocket'])).toBe(true);
  });
  it('true when products present', () => {
    expect(dependsOnAllegro(['products'])).toBe(true);
  });
  it('false for ad-platform-only sets', () => {
    expect(dependsOnAllegro(['meta', 'google_ads', 'criteo', 'ga4', 'pinterest'])).toBe(false);
  });
  it('false for empty', () => {
    expect(dependsOnAllegro([])).toBe(false);
  });
});
