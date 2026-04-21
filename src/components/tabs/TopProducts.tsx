'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { type ColumnDef } from '@tanstack/react-table';
import { useFilters } from '@/stores/filters';
import { HeroMetric } from '@/components/primitives/HeroMetric';
import { DataTable } from '@/components/primitives/DataTable';
import { DeltaBadge } from '@/components/primitives/DeltaBadge';
import { LoadingCard, ErrorCard, EmptyCard } from '@/components/primitives/StateCard';
import { formatPLN, formatInt } from '@/lib/format';
import { cn } from '@/components/ui/cn';

type Item = {
  group: string;
  shrRevenue: number;
  allegroRevenue: number;
  shrQty: number;
  allegroQty: number;
  total: number;
  yoyShrRevenue: number;
  yoyAllegroRevenue: number;
  yoyTotal: number | null;
  yoyDelta: number | null;
  yoyShrDelta: number | null;
  yoyAllegroDelta: number | null;
  shrShare: number | null;
  yoyShrShare: number | null;
  shrShareDelta: number | null;
  alerts: string[];
};

type Level = 'category' | 'collection' | 'sku';

export function TopProductsTab() {
  const { period, compare } = useFilters();
  const [level, setLevel] = useState<Level>('category');
  const [drillCategory, setDrillCategory] = useState<string | null>(null);

  const params = new URLSearchParams({ period, compare, level });
  if (drillCategory && level !== 'category') params.set('category', drillCategory);
  const { data, error, isLoading } = useSWR<any>(`/api/data/top-products?${params.toString()}`);

  const columns = useMemo<ColumnDef<Item, any>[]>(
    () => [
      {
        accessorKey: 'group',
        header: level === 'category' ? 'Kategoria' : level === 'collection' ? 'Kolekcja' : 'SKU',
        cell: ({ row }) => {
          const isCategoryLevel = level === 'category';
          const isCollectionLevel = level === 'collection';
          const canDrill = isCategoryLevel || isCollectionLevel;
          const onClick = () => {
            if (isCategoryLevel) {
              setDrillCategory(row.original.group);
              setLevel('collection');
            } else if (isCollectionLevel) {
              setLevel('sku');
            }
          };
          return (
            <div className="flex items-center gap-2">
              {canDrill ? (
                <button
                  onClick={onClick}
                  className="font-medium text-[var(--color-accent-primary)] hover:underline text-left"
                >
                  {row.original.group}
                </button>
              ) : (
                <span className="font-medium truncate max-w-[360px]">{row.original.group}</span>
              )}
              {row.original.alerts.length > 0 && (
                <span className="chip text-[10px] py-0 px-1.5 bg-[var(--color-accent-negative-bg)] text-[var(--color-accent-negative)] border-[var(--color-accent-negative)]/30">
                  ⚠ {row.original.alerts.length}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'shrRevenue',
        header: 'Shoper',
        meta: { numeric: true },
        cell: ({ row }) => (
          <div className="flex flex-col items-end gap-0.5">
            <span>{formatPLN(row.original.shrRevenue)}</span>
            {row.original.yoyShrRevenue > 0 && (
              <span className="text-[10px] text-[var(--color-ink-tertiary)] numeric">
                rok temu: {formatPLN(row.original.yoyShrRevenue)}
              </span>
            )}
            {row.original.yoyShrDelta != null && (
              <DeltaBadge pct={row.original.yoyShrDelta} size="xs" />
            )}
          </div>
        ),
      },
      {
        accessorKey: 'allegroRevenue',
        header: 'Allegro',
        meta: { numeric: true },
        cell: ({ row }) => (
          <div className="flex flex-col items-end gap-0.5">
            <span>{formatPLN(row.original.allegroRevenue)}</span>
            {row.original.yoyAllegroRevenue > 0 && (
              <span className="text-[10px] text-[var(--color-ink-tertiary)] numeric">
                rok temu: {formatPLN(row.original.yoyAllegroRevenue)}
              </span>
            )}
            {row.original.yoyAllegroDelta != null && (
              <DeltaBadge pct={row.original.yoyAllegroDelta} size="xs" />
            )}
          </div>
        ),
      },
      { accessorKey: 'total', header: 'Razem', meta: { numeric: true }, cell: (i) => formatPLN(i.getValue() as number) },
      {
        accessorKey: 'shrShare',
        header: 'Udział SHR',
        meta: { numeric: true },
        cell: ({ row }) => {
          const share = row.original.shrShare;
          if (share == null) return <span className="text-[var(--color-ink-tertiary)]">—</span>;
          const pp = row.original.shrShareDelta;
          return (
            <div className="flex flex-col items-end gap-0.5">
              <span className="numeric">{(share * 100).toFixed(1).replace('.', ',')}%</span>
              {pp != null && (
                <span
                  className="numeric text-[10px]"
                  style={{
                    color:
                      pp > 0.02 ? 'var(--color-accent-positive)' :
                      pp < -0.02 ? 'var(--color-accent-negative)' :
                      'var(--color-ink-tertiary)',
                  }}
                >
                  {pp > 0 ? '+' : ''}{(pp * 100).toFixed(1).replace('.', ',')}pp vs rok
                </span>
              )}
            </div>
          );
        },
      },
      { accessorKey: 'shrQty', header: 'Sztuk Shoper', meta: { numeric: true }, cell: (i) => formatInt(i.getValue() as number) },
      { accessorKey: 'allegroQty', header: 'Sztuk Allegro', meta: { numeric: true }, cell: (i) => formatInt(i.getValue() as number) },
      {
        accessorKey: 'yoyDelta',
        header: 'YoY (razem)',
        meta: { numeric: true },
        cell: ({ row }) =>
          row.original.yoyDelta == null
            ? <span className="text-[var(--color-ink-tertiary)]">—</span>
            : <DeltaBadge pct={row.original.yoyDelta} size="xs" />,
      },
    ],
    [level]
  );

  if (isLoading) return <LoadingCard minHeight={360} />;
  if (error) return <ErrorCard error={String((error as Error).message ?? error)} />;
  if (!data?.items?.length) {
    return <EmptyCard
      title="Brak danych produktowych"
      subtitle="Uruchom backfill: /api/admin/backfill?sources=products. products_daily musi być zsynchronizowane z BaseLinker."
    />;
  }

  const items: Item[] = data.items;
  const summary = data.summary;
  const alerts: Item[] = data.alerts ?? [];

  const breadcrumbs = (
    <div className="flex items-center gap-2 text-[12px] text-[var(--color-ink-tertiary)]">
      <button
        onClick={() => { setLevel('category'); setDrillCategory(null); }}
        className={cn('hover:underline', level === 'category' && 'font-semibold text-[var(--color-ink-primary)]')}
      >
        Kategorie
      </button>
      {drillCategory && (
        <>
          <span>›</span>
          <button
            onClick={() => setLevel('collection')}
            className={cn('hover:underline', level === 'collection' && 'font-semibold text-[var(--color-ink-primary)]')}
          >
            {drillCategory}
          </button>
        </>
      )}
      {level === 'sku' && (
        <>
          <span>›</span>
          <span className="font-semibold text-[var(--color-ink-primary)]">Produkty</span>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      <div>
        <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Produkty & kategorie</h2>
        <p className="text-[13px] text-[var(--color-ink-tertiary)] mt-0.5">
          Źródło: BaseLinker · wartość towarów (bez dostawy) · porównanie YoY: {data.yoyRange.start} → {data.yoyRange.end}
        </p>
        <p className="text-[11px] text-[var(--color-ink-tertiary)] mt-1 italic">
          Różnica ~2–3% vs Podsumowanie = koszty dostawy wliczone w wartość zamówienia w SellRocket.
        </p>
        <div className="mt-2">{breadcrumbs}</div>
      </div>

      {alerts.length > 0 && (
        <div className="card p-4 border-[var(--color-accent-negative)]/40 bg-[var(--color-accent-negative-bg)]">
          <div className="flex items-start gap-3">
            <div className="w-1 min-h-12 rounded-full bg-[var(--color-accent-negative)]" />
            <div className="flex-1">
              <div className="text-[13px] font-semibold">⚠ {alerts.length} alertów</div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                {alerts.slice(0, 12).map((a) => (
                  <div key={a.group} className="flex items-center gap-2">
                    <span className="font-medium">{a.group}</span>
                    <span className="text-[var(--color-ink-tertiary)]">{a.alerts.join(', ')}</span>
                    {a.yoyDelta != null && <DeltaBadge pct={a.yoyDelta} size="xs" />}
                  </div>
                ))}
              </div>
              {alerts.length > 12 && (
                <div className="mt-2 text-[11px] text-[var(--color-ink-tertiary)]">…i {alerts.length - 12} więcej w tabeli poniżej</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <HeroMetric label="Grupy" value={summary.groups} format="int" />
        <HeroMetric label="Shoper revenue" value={summary.totalShrRevenue} format="pln" tone="primary" />
        <HeroMetric label="Allegro revenue" value={summary.totalAllegroRevenue} format="pln" />
        <HeroMetric
          label="Razem (Shoper + Allegro)"
          value={summary.totalRevenue}
          format="pln"
        />
      </div>

      <DataTable data={items} columns={columns} pageSize={25} />
    </div>
  );
}
