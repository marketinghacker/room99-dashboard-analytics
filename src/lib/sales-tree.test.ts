import { describe, it, expect } from 'vitest';
import { buildSalesTree, type FlatRow } from './sales-tree';

describe('buildSalesTree', () => {
  const rows: FlatRow[] = [
    { source: 'shr', category: 'NARZUTA', collection: 'MOLLY', sku: 'SKU1',
      product_name: 'Narzuta Molly Krem', revenue: 100, quantity: 2, orders: 1,
      revenue_prev: 80, daily: [10, 20, 30, 40] },
    { source: 'shr', category: 'NARZUTA', collection: 'MOLLY', sku: 'SKU2',
      product_name: 'Narzuta Molly Szara', revenue: 50, quantity: 1, orders: 1,
      revenue_prev: 60, daily: [5, 10, 15, 20] },
    { source: 'allegro', category: 'FIRANA', collection: 'NOELLE', sku: 'SKU3',
      product_name: 'Firana Noelle', revenue: 200, quantity: 4, orders: 2,
      revenue_prev: 150, daily: [50, 50, 50, 50] },
  ];

  it('groups by source → category → collection → product', () => {
    const tree = buildSalesTree(rows);
    expect(tree).toHaveLength(2); // shr + allegro
    const shr = tree.find(c => c.source === 'shr')!;
    expect(shr.metrics.revenue).toBe(150); // 100 + 50
    expect(shr.categories).toHaveLength(1);
    expect(shr.categories[0].collections[0].products).toHaveLength(2);
  });

  it('sums daily arrays element-wise for each level', () => {
    const tree = buildSalesTree(rows);
    const shrCollection = tree.find(c => c.source === 'shr')!.categories[0].collections[0];
    expect(shrCollection.daily).toEqual([15, 30, 45, 60]); // 10+5, 20+10, ...
  });

  it('calculates change % vs prev period', () => {
    const tree = buildSalesTree(rows);
    const shrProduct = tree.find(c => c.source === 'shr')!.categories[0].collections[0].products[0];
    expect(shrProduct.metrics.change).toBeCloseTo(25); // (100-80)/80 = 25%
  });

  it('returns empty array for empty input', () => {
    expect(buildSalesTree([])).toEqual([]);
  });

  it('sorts every level by revenue descending', () => {
    const tree = buildSalesTree(rows);
    expect(tree[0].source).toBe('allegro'); // 200 > 150
    const shr = tree.find(c => c.source === 'shr')!;
    expect(shr.categories[0].collections[0].products[0].sku).toBe('SKU1'); // 100 > 50
  });
});
