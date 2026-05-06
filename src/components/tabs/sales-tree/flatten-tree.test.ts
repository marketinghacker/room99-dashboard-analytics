import { describe, it, expect } from 'vitest';
import { flattenTree } from './flatten-tree';
import type { ChannelNode } from '@/lib/sales-tree';

const sample: ChannelNode[] = [
  {
    source: 'shr',
    metrics: { revenue: 100, quantity: 1, orders: 1, revenuePrev: 80, change: 25 },
    daily: [], categories: [
      { category: 'NARZUTA', metrics: { revenue: 100, quantity: 1, orders: 1, revenuePrev: 80, change: 25 },
        daily: [], collections: [
          { collection: 'MOLLY', metrics: { revenue: 100, quantity: 1, orders: 1, revenuePrev: 80, change: 25 },
            daily: [], products: [{ sku: 'A', name: 'A name', daily: [], metrics: { revenue: 100, quantity: 1, orders: 1, revenuePrev: 80, change: 25 } }] }
        ] }
    ]
  }
];

describe('flattenTree', () => {
  it('returns only roots when no nodes expanded', () => {
    const out = flattenTree(sample, new Set());
    expect(out).toHaveLength(1);
    expect(out[0].depth).toBe(0);
    expect(out[0].label).toBe('Shoper'); // shr source label
  });

  it('expands one level when channel is in expanded set', () => {
    const out = flattenTree(sample, new Set(['shr']));
    expect(out).toHaveLength(2);
    expect(out[1].depth).toBe(1);
    expect(out[1].label).toBe('NARZUTA');
  });

  it('shows full path when all expanded', () => {
    const expanded = new Set(['shr', 'shr|NARZUTA', 'shr|NARZUTA|MOLLY']);
    const out = flattenTree(sample, expanded);
    expect(out).toHaveLength(4);
    expect(out[3].label).toBe('A name');
    expect(out[3].sublabel).toBe('A');
    expect(out[3].depth).toBe(3);
    expect(out[3].hasChildren).toBe(false);
  });

  it('uses Allegro label for source allegro', () => {
    const out = flattenTree([{ ...sample[0], source: 'allegro' }], new Set());
    expect(out[0].label).toBe('Allegro');
  });

  it('limits products to top 10 by default', () => {
    // Build a collection with 15 products
    const products = Array.from({ length: 15 }, (_, i) => ({
      sku: `SKU${i}`,
      name: `Product ${i}`,
      daily: [],
      metrics: { revenue: 1000 - i, quantity: 1, orders: 1, revenuePrev: 800, change: 25 },
    }));
    const big: ChannelNode[] = [
      {
        source: 'shr',
        metrics: { revenue: 0, quantity: 0, orders: 0, revenuePrev: 0, change: 0 },
        daily: [],
        categories: [
          {
            category: 'NARZUTA',
            metrics: { revenue: 0, quantity: 0, orders: 0, revenuePrev: 0, change: 0 },
            daily: [],
            collections: [
              {
                collection: 'MOLLY',
                metrics: { revenue: 0, quantity: 0, orders: 0, revenuePrev: 0, change: 0 },
                daily: [],
                products,
              },
            ],
          },
        ],
      },
    ];
    const expanded = new Set(['shr', 'shr|NARZUTA', 'shr|NARZUTA|MOLLY']);
    const out = flattenTree(big, expanded);
    // 1 channel + 1 category + 1 collection + 10 products + 1 "more" row = 14
    expect(out).toHaveLength(14);
    const productRows = out.filter((r) => r.depth === 3 && r.kind !== 'more');
    expect(productRows).toHaveLength(10);
    const moreRow = out.find((r) => r.kind === 'more');
    expect(moreRow).toBeDefined();
    expect(moreRow!.collectionId).toBe('shr|NARZUTA|MOLLY');
    expect(moreRow!.depth).toBe(3);
  });

  it('shows all products when collection is in unbounded set', () => {
    const products = Array.from({ length: 15 }, (_, i) => ({
      sku: `SKU${i}`,
      name: `Product ${i}`,
      daily: [],
      metrics: { revenue: 1000 - i, quantity: 1, orders: 1, revenuePrev: 800, change: 25 },
    }));
    const big: ChannelNode[] = [
      {
        source: 'shr',
        metrics: { revenue: 0, quantity: 0, orders: 0, revenuePrev: 0, change: 0 },
        daily: [],
        categories: [
          {
            category: 'NARZUTA',
            metrics: { revenue: 0, quantity: 0, orders: 0, revenuePrev: 0, change: 0 },
            daily: [],
            collections: [
              {
                collection: 'MOLLY',
                metrics: { revenue: 0, quantity: 0, orders: 0, revenuePrev: 0, change: 0 },
                daily: [],
                products,
              },
            ],
          },
        ],
      },
    ];
    const expanded = new Set(['shr', 'shr|NARZUTA', 'shr|NARZUTA|MOLLY']);
    const unbounded = new Set(['shr|NARZUTA|MOLLY']);
    const out = flattenTree(big, expanded, { unbounded });
    // 1 + 1 + 1 + 15 = 18, no more row
    expect(out).toHaveLength(18);
    const moreRow = out.find((r) => r.kind === 'more');
    expect(moreRow).toBeUndefined();
  });
});
