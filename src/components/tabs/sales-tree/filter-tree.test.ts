import { describe, it, expect } from 'vitest';
import { filterTree } from './filter-tree';
import type { ChannelNode } from '@/lib/sales-tree';

const sample: ChannelNode[] = [
  {
    source: 'shr',
    metrics: { revenue: 300, quantity: 3, orders: 3, revenuePrev: 200, change: 50 },
    daily: [],
    categories: [
      {
        category: 'NARZUTA',
        metrics: { revenue: 200, quantity: 2, orders: 2, revenuePrev: 150, change: 33.3 },
        daily: [],
        collections: [
          {
            collection: 'MOLLY',
            metrics: { revenue: 100, quantity: 1, orders: 1, revenuePrev: 80, change: 25 },
            daily: [],
            products: [{ sku: 'M1', name: 'Narzuta Molly Krem', daily: [], metrics: { revenue: 100, quantity: 1, orders: 1, revenuePrev: 80, change: 25 } }],
          },
          {
            collection: 'NOELLE',
            metrics: { revenue: 100, quantity: 1, orders: 1, revenuePrev: 70, change: 42.9 },
            daily: [],
            products: [{ sku: 'N1', name: 'Narzuta Noelle Granat', daily: [], metrics: { revenue: 100, quantity: 1, orders: 1, revenuePrev: 70, change: 42.9 } }],
          },
        ],
      },
      {
        category: 'FIRANA',
        metrics: { revenue: 100, quantity: 1, orders: 1, revenuePrev: 50, change: 100 },
        daily: [],
        collections: [
          {
            collection: 'AURA',
            metrics: { revenue: 100, quantity: 1, orders: 1, revenuePrev: 50, change: 100 },
            daily: [],
            products: [{ sku: 'A1', name: 'Firana Aura', daily: [], metrics: { revenue: 100, quantity: 1, orders: 1, revenuePrev: 50, change: 100 } }],
          },
        ],
      },
    ],
  },
];

describe('filterTree', () => {
  it('returns input unchanged for empty query', () => {
    const out = filterTree(sample, '');
    expect(out.tree).toEqual(sample);
    expect(out.autoExpanded.size).toBe(0);
  });

  it('keeps only branches with matching products (search "molly")', () => {
    const out = filterTree(sample, 'molly');
    expect(out.tree).toHaveLength(1); // shr
    expect(out.tree[0].categories).toHaveLength(1); // only NARZUTA
    expect(out.tree[0].categories[0].collections).toHaveLength(1); // only MOLLY
    expect(out.tree[0].categories[0].collections[0].products).toHaveLength(1);
    expect(out.tree[0].categories[0].collections[0].products[0].sku).toBe('M1');
  });

  it('returns autoExpanded set covering match path', () => {
    const out = filterTree(sample, 'molly');
    expect(out.autoExpanded.has('shr')).toBe(true);
    expect(out.autoExpanded.has('shr|NARZUTA')).toBe(true);
    expect(out.autoExpanded.has('shr|NARZUTA|MOLLY')).toBe(true);
  });

  it('returns empty tree when nothing matches', () => {
    const out = filterTree(sample, 'xyz123nomatch');
    expect(out.tree).toEqual([]);
    expect(out.autoExpanded.size).toBe(0);
  });

  it('matches by SKU as well', () => {
    const out = filterTree(sample, 'A1');
    expect(out.tree[0].categories[0].category).toBe('FIRANA');
  });

  it('matches by category name', () => {
    const out = filterTree(sample, 'firana');
    expect(out.tree[0].categories).toHaveLength(1);
    expect(out.tree[0].categories[0].category).toBe('FIRANA');
  });
});
