import { describe, it, expect } from 'vitest';
import { fetchSalesTreeRows } from './sales-tree-query';

describe('fetchSalesTreeRows', () => {
  // Skip if no DB configured (e.g., in CI without secrets)
  const hasDb = !!process.env.DATABASE_URL;
  const t = hasDb ? it : it.skip;

  t('returns flat rows with daily arrays for known period', async () => {
    const rows = await fetchSalesTreeRows({
      start: '2026-04-01', end: '2026-04-15',
      compareStart: '2026-03-17', compareEnd: '2026-03-31',
      channels: ['shr', 'allegro'],
    });
    expect(Array.isArray(rows)).toBe(true);
    if (rows.length > 0) {
      const r = rows[0];
      expect(typeof r.source).toBe('string');
      expect(['shr', 'allegro']).toContain(r.source);
      expect(typeof r.product_name).toBe('string');
      expect(typeof r.revenue).toBe('number');
      expect(Array.isArray(r.daily)).toBe(true);
      expect(r.daily.length).toBe(15); // Apr 1..15 = 15 days
    }
  });

  t('excludes "all" pseudo-source', async () => {
    const rows = await fetchSalesTreeRows({
      start: '2026-04-01', end: '2026-04-15',
      compareStart: '2026-03-17', compareEnd: '2026-03-31',
      channels: ['shr', 'allegro'],
    });
    expect(rows.every(r => r.source !== 'all')).toBe(true);
  });
});
