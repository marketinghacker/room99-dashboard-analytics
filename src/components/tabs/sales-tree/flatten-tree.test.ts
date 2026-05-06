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
});
