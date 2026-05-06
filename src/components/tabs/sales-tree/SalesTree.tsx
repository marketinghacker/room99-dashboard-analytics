'use client';
import { useMemo, useReducer, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ChannelNode } from '@/lib/sales-tree';
import { flattenTree } from './flatten-tree';
import { filterTree } from './filter-tree';
import { SalesTreeRow } from './SalesTreeRow';
import { ExportModal } from './ExportModal';

type State = { expanded: Set<string>; unbounded: Set<string> };
type Action =
  | { type: 'toggle'; id: string }
  | { type: 'expandAll'; ids: string[] }
  | { type: 'collapseAll' }
  | { type: 'showMore'; collectionId: string };

function reducer(state: State, a: Action): State {
  if (a.type === 'collapseAll') return { expanded: new Set(), unbounded: new Set() };
  if (a.type === 'expandAll') return { ...state, expanded: new Set(a.ids) };
  if (a.type === 'showMore') {
    const next = new Set(state.unbounded);
    next.add(a.collectionId);
    return { ...state, unbounded: next };
  }
  // toggle
  const next = new Set(state.expanded);
  if (next.has(a.id)) next.delete(a.id);
  else next.add(a.id);
  return { ...state, expanded: next };
}

function collectAllIds(channels: ChannelNode[]): string[] {
  const out: string[] = [];
  for (const ch of channels) {
    out.push(ch.source);
    for (const cat of ch.categories) {
      out.push(`${ch.source}|${cat.category}`);
      for (const col of cat.collections) {
        out.push(`${ch.source}|${cat.category}|${col.collection}`);
      }
    }
  }
  return out;
}

export function SalesTree({ channels, start, end }: { channels: ChannelNode[]; start?: string; end?: string }) {
  const [state, dispatch] = useReducer(reducer, { expanded: new Set<string>(), unbounded: new Set<string>() });
  const [query, setQuery] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => filterTree(channels, query), [channels, query]);
  const effectiveExpanded = query.trim() ? filtered.autoExpanded : state.expanded;
  const visible = useMemo(
    () => flattenTree(filtered.tree, effectiveExpanded, { unbounded: state.unbounded }),
    [filtered.tree, effectiveExpanded, state.unbounded],
  );

  const virt = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (visible[i]?.depth === 3 ? 32 : 40),
    overscan: 8,
  });

  return (
    <div className="card">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-line-soft)]">
        <input
          type="text"
          placeholder="Szukaj produktu, SKU, kategorii…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-3 py-1.5 text-[13px] bg-[var(--color-bg-base)] border border-[var(--color-line-soft)] rounded-md focus:outline-none focus:border-[var(--color-accent)]"
        />
        <button
          type="button"
          onClick={() => dispatch({ type: 'expandAll', ids: collectAllIds(filtered.tree) })}
          className="px-2.5 py-1.5 text-[12px] text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)] border border-[var(--color-line-soft)] rounded-md"
        >
          Rozwiń wszystko
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'collapseAll' })}
          className="px-2.5 py-1.5 text-[12px] text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)] border border-[var(--color-line-soft)] rounded-md"
        >
          Zwiń
        </button>
        <button
          type="button"
          disabled={!start || !end}
          onClick={() => setExportOpen(true)}
          className="px-2.5 py-1.5 text-[12px] text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)] border border-[var(--color-line-soft)] rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          title={!start || !end ? 'Brak okresu — eksport nie jest dostępny' : 'Eksport CSV / XLSX'}
        >
          Eksport
        </button>
      </div>
      <div
        className="grid items-center px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-ink-tertiary)] border-b border-[var(--color-line-soft)]"
        style={{ gridTemplateColumns: 'minmax(280px, 1fr) 56px 80px 80px 110px 80px' }}
      >
        <div>Kanał / Kategoria / Kolekcja / Produkt</div>
        <div className="text-center">Trend</div>
        <div className="text-right">Ilość</div>
        <div className="text-right">Zamówienia</div>
        <div className="text-right">Przychód</div>
        <div className="text-right">vs poprz.</div>
      </div>
      <div ref={parentRef} style={{ height: 600, overflow: 'auto', position: 'relative' }}>
        <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
          {virt.getVirtualItems().map((vi) => {
            const row = visible[vi.index];
            return (
              <div
                key={row.id}
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  transform: `translateY(${vi.start}px)`, height: vi.size,
                }}
              >
                <SalesTreeRow
                  {...row}
                  onToggle={() => dispatch({ type: 'toggle', id: row.id })}
                  onShowMore={(collectionId) => dispatch({ type: 'showMore', collectionId })}
                />
              </div>
            );
          })}
        </div>
      </div>
      {start && end && (
        <ExportModal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          start={start}
          end={end}
        />
      )}
    </div>
  );
}
