import type { ChannelNode, Metrics } from '@/lib/sales-tree';

export type VisibleRow = {
  id: string;
  label: string;
  sublabel?: string;
  depth: number;
  metrics: Metrics;
  daily: number[];
  hasChildren: boolean;
  expanded: boolean;
};

function chLabel(source: string): string {
  if (source === 'shr') return 'Shoper';
  if (source === 'allegro') return 'Allegro';
  return source;
}

export function flattenTree(channels: ChannelNode[], expanded: Set<string>): VisibleRow[] {
  const out: VisibleRow[] = [];
  for (const ch of channels) {
    const chId = ch.source;
    const chExpanded = expanded.has(chId);
    out.push({
      id: chId, label: chLabel(ch.source), depth: 0,
      metrics: ch.metrics, daily: ch.daily,
      hasChildren: ch.categories.length > 0, expanded: chExpanded,
    });
    if (!chExpanded) continue;
    for (const cat of ch.categories) {
      const catId = `${chId}|${cat.category}`;
      const catExpanded = expanded.has(catId);
      out.push({
        id: catId, label: cat.category, depth: 1,
        metrics: cat.metrics, daily: cat.daily,
        hasChildren: cat.collections.length > 0, expanded: catExpanded,
      });
      if (!catExpanded) continue;
      for (const col of cat.collections) {
        const colId = `${catId}|${col.collection}`;
        const colExpanded = expanded.has(colId);
        out.push({
          id: colId, label: col.collection, depth: 2,
          metrics: col.metrics, daily: col.daily,
          hasChildren: col.products.length > 0, expanded: colExpanded,
        });
        if (!colExpanded) continue;
        for (const p of col.products) {
          out.push({
            id: `${colId}|${p.sku}`, label: p.name, sublabel: p.sku, depth: 3,
            metrics: p.metrics, daily: p.daily, hasChildren: false, expanded: false,
          });
        }
      }
    }
  }
  return out;
}
