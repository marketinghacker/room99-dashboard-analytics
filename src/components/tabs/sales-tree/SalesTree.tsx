'use client';
import { useMemo, useReducer, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ChannelNode } from '@/lib/sales-tree';
import { flattenTree } from './flatten-tree';
import { SalesTreeRow } from './SalesTreeRow';

type State = Set<string>;
type Action = { type: 'toggle'; id: string } | { type: 'expandAll'; ids: string[] } | { type: 'collapseAll' };

function reducer(state: State, a: Action): State {
  if (a.type === 'collapseAll') return new Set();
  if (a.type === 'expandAll') return new Set(a.ids);
  const next = new Set(state);
  if (next.has(a.id)) next.delete(a.id);
  else next.add(a.id);
  return next;
}

export function SalesTree({ channels }: { channels: ChannelNode[] }) {
  const [expanded, dispatch] = useReducer(reducer, new Set<string>());
  const visible = useMemo(() => flattenTree(channels, expanded), [channels, expanded]);
  const parentRef = useRef<HTMLDivElement>(null);

  const virt = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (visible[i]?.depth === 3 ? 32 : 40),
    overscan: 8,
  });

  return (
    <div className="card">
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
                <SalesTreeRow {...row} onToggle={() => dispatch({ type: 'toggle', id: row.id })} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
