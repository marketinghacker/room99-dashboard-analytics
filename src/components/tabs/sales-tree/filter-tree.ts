import Fuse from 'fuse.js';
import type { ChannelNode, ProductNode, CategoryNode, CollectionNode } from '@/lib/sales-tree';

export type FilterResult = { tree: ChannelNode[]; autoExpanded: Set<string> };

type SearchableProduct = {
  sku: string;
  name: string;
  category: string;
  collection: string;
  // path identifiers for autoExpand
  channelId: string;
  categoryId: string;
  collectionId: string;
};

export function filterTree(channels: ChannelNode[], query: string): FilterResult {
  const q = query.trim();
  if (!q) return { tree: channels, autoExpanded: new Set() };

  // Flatten products with path identifiers
  const searchable: SearchableProduct[] = [];
  for (const ch of channels) {
    for (const cat of ch.categories) {
      for (const col of cat.collections) {
        for (const p of col.products) {
          searchable.push({
            sku: p.sku, name: p.name,
            category: cat.category, collection: col.collection,
            channelId: ch.source,
            categoryId: `${ch.source}|${cat.category}`,
            collectionId: `${ch.source}|${cat.category}|${col.collection}`,
          });
        }
      }
    }
  }

  const fuse = new Fuse(searchable, {
    keys: [
      { name: 'name', weight: 2 },
      { name: 'sku', weight: 1.5 },
      { name: 'category', weight: 1 },
      { name: 'collection', weight: 1 },
    ],
    threshold: 0.3,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  const hits = fuse.search(q);
  if (hits.length === 0) return { tree: [], autoExpanded: new Set() };

  // Collect matching SKUs and the paths that need to be kept/expanded
  const matchingSkus = new Set<string>();
  const autoExpanded = new Set<string>();
  for (const h of hits) {
    const m = h.item;
    matchingSkus.add(m.channelId + '||' + m.sku);
    autoExpanded.add(m.channelId);
    autoExpanded.add(m.categoryId);
    autoExpanded.add(m.collectionId);
  }

  // Rebuild filtered tree, dropping branches without hits
  const filteredChannels: ChannelNode[] = [];
  for (const ch of channels) {
    const filteredCategories: CategoryNode[] = [];
    for (const cat of ch.categories) {
      const filteredCollections: CollectionNode[] = [];
      for (const col of cat.collections) {
        const filteredProducts: ProductNode[] = col.products.filter(
          (p) => matchingSkus.has(ch.source + '||' + p.sku),
        );
        if (filteredProducts.length === 0) continue;
        filteredCollections.push({ ...col, products: filteredProducts });
      }
      if (filteredCollections.length === 0) continue;
      filteredCategories.push({ ...cat, collections: filteredCollections });
    }
    if (filteredCategories.length === 0) continue;
    filteredChannels.push({ ...ch, categories: filteredCategories });
  }

  return { tree: filteredChannels, autoExpanded };
}
