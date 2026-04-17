'use client';

import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import { HeroMetric } from '@/components/primitives/HeroMetric';
import { ScoreCard } from '@/components/primitives/ScoreCard';
import { DataTable } from '@/components/primitives/DataTable';
import { ChartCard } from '@/components/primitives/ChartCard';
import { ChartBar } from '@/components/primitives/charts';
import { LoadingCard, ErrorCard, EmptyCard } from '@/components/primitives/StateCard';
import { DeltaBadge } from '@/components/primitives/DeltaBadge';
import { formatPLN, formatInt, formatPct } from '@/lib/format';
import { cn } from '@/components/ui/cn';

type CategoryRow = {
  category: string;
  viewed: number;
  addedToCart: number;
  purchased: number;
  revenue: number;
  productCount: number;
  yoyRevenue: number | null;
  yoyDelta: number | null;
  alerts: string[];
};

type ItemRow = {
  name: string;
  category: string;
  viewed: number;
  addedToCart: number;
  purchased: number;
  revenue: number;
  yoyRevenue: number | null;
  yoyDelta: number | null;
};

export function TopProductsTab() {
  const { data, error, isLoading } = useFilteredSWR<any>('/api/data/top-products');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const catColumns = useMemo<ColumnDef<CategoryRow, any>[]>(
    () => [
      {
        accessorKey: 'category',
        header: 'Kategoria',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedCategory(row.original.category)}
              className="font-medium text-[var(--color-accent-primary)] hover:underline text-left"
            >
              {row.original.category}
            </button>
            {row.original.alerts.length > 0 && (
              <span className="chip bg-[var(--color-accent-negative-bg)] text-[var(--color-accent-negative)] border-[var(--color-accent-negative)]/30 text-[10px] py-0 px-1.5">
                ⚠ {row.original.alerts.length}
              </span>
            )}
          </div>
        ),
      },
      { accessorKey: 'productCount', header: 'Produkty', meta: { numeric: true }, cell: (i) => formatInt(i.getValue() as number) },
      { accessorKey: 'viewed', header: 'Wyświetlenia', meta: { numeric: true }, cell: (i) => formatInt(i.getValue() as number) },
      { accessorKey: 'purchased', header: 'Sprzedane szt.', meta: { numeric: true }, cell: (i) => formatInt(i.getValue() as number) },
      { accessorKey: 'revenue', header: 'Przychód', meta: { numeric: true }, cell: (i) => formatPLN(i.getValue() as number) },
      {
        accessorKey: 'yoyRevenue',
        header: 'Rok temu',
        meta: { numeric: true },
        cell: (i) => formatPLN(i.getValue() as number | null),
      },
      {
        accessorKey: 'yoyDelta',
        header: 'YoY',
        meta: { numeric: true },
        cell: ({ row }) =>
          row.original.yoyDelta == null ? (
            <span className="text-[var(--color-ink-tertiary)]">—</span>
          ) : (
            <DeltaBadge pct={row.original.yoyDelta} size="xs" />
          ),
      },
    ],
    []
  );

  const itemColumns = useMemo<ColumnDef<ItemRow, any>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Produkt',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium truncate max-w-[340px]" title={row.original.name}>{row.original.name}</span>
            {row.original.category && (
              <span className="text-[11px] text-[var(--color-ink-tertiary)]">{row.original.category}</span>
            )}
          </div>
        ),
      },
      { accessorKey: 'viewed', header: 'Wyświetleń', meta: { numeric: true }, cell: (i) => formatInt(i.getValue() as number) },
      { accessorKey: 'addedToCart', header: 'Do koszyka', meta: { numeric: true }, cell: (i) => formatInt(i.getValue() as number) },
      { accessorKey: 'purchased', header: 'Zakupów', meta: { numeric: true }, cell: (i) => formatInt(i.getValue() as number) },
      { accessorKey: 'revenue', header: 'Przychód', meta: { numeric: true }, cell: (i) => formatPLN(i.getValue() as number) },
      {
        accessorKey: 'yoyDelta',
        header: 'YoY',
        meta: { numeric: true },
        cell: ({ row }) =>
          row.original.yoyDelta == null ? (
            <span className="text-[var(--color-ink-tertiary)]">—</span>
          ) : (
            <DeltaBadge pct={row.original.yoyDelta} size="xs" />
          ),
      },
    ],
    []
  );

  if (isLoading) return <LoadingCard minHeight={360} />;
  if (error) return <ErrorCard error={String(error.message ?? error)} />;
  if (!data?.categories?.length) return <EmptyCard title="Brak danych produktowych" subtitle="GA4 nie zwrócił danych items-level dla tego okresu" />;

  const s = data.summary;
  const categories: CategoryRow[] = data.categories;
  const items: ItemRow[] = data.items;
  const alerts: CategoryRow[] = data.alerts ?? [];

  const filteredItems = selectedCategory
    ? items.filter((i) => i.category === selectedCategory)
    : items;

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      <div>
        <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Produkty & kategorie</h2>
        <p className="text-[13px] text-[var(--color-ink-tertiary)] mt-0.5">
          Źródło: GA4 Items Report · porównanie rok-do-roku (YoY: {data.yoyRange.start} → {data.yoyRange.end})
        </p>
      </div>

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <div className="card p-4 border-[var(--color-accent-negative)]/40 bg-[var(--color-accent-negative-bg)]">
          <div className="flex items-start gap-3">
            <div className="w-1 min-h-12 rounded-full bg-[var(--color-accent-negative)]" />
            <div className="flex-1">
              <div className="text-[13px] font-semibold">
                ⚠ {alerts.length} {alerts.length === 1 ? 'alert' : 'alertów'} kategoryjnych
              </div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                {alerts.map((a) => (
                  <div key={a.category} className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedCategory(a.category)}
                      className="font-medium hover:underline text-left"
                    >
                      {a.category}
                    </button>
                    <span className="text-[var(--color-ink-tertiary)]">{a.alerts.join(', ')}</span>
                    {a.yoyDelta != null && <DeltaBadge pct={a.yoyDelta} size="xs" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <HeroMetric label="Produkty (unikatowe)" value={s.totalProducts} format="int" tone="primary" />
        <HeroMetric label="Kategorie" value={s.categoriesCount} format="int" />
        <HeroMetric label="Przychód produktów (GA4)" value={s.totalRevenue} format="pln" />
        <HeroMetric label="Sprzedane sztuki" value={s.totalPurchased} format="int" />
      </div>

      <ChartCard title="Top 10 kategorii wg przychodu" subtitle="YoY comparison per category">
        <ChartBar
          data={categories.slice(0, 10).map((c) => ({
            name: c.category.length > 28 ? c.category.slice(0, 25) + '…' : c.category,
            value: c.revenue,
            yoy: c.yoyRevenue ?? 0,
          }))}
          xKey="name"
          yKeys={[
            { key: 'value', label: 'Aktualnie', color: 'var(--color-chart-3)' },
            { key: 'yoy', label: 'Rok temu', color: 'var(--color-chart-1)' },
          ]}
          money
          horizontal
          height={Math.max(280, categories.slice(0, 10).length * 36)}
        />
      </ChartCard>

      {/* Categories table */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[15px] font-semibold">Kategorie ({categories.length})</h3>
          <p className="text-[12px] text-[var(--color-ink-tertiary)]">Kliknij kategorię aby zobaczyć produkty</p>
        </div>
        <DataTable data={categories} columns={catColumns} pageSize={20} />
      </div>

      {/* Products table (filtered) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[15px] font-semibold">
            Produkty {selectedCategory ? `w kategorii "${selectedCategory}"` : ''} ({filteredItems.length})
          </h3>
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-[12px] text-[var(--color-accent-primary)] hover:underline"
            >
              ← pokaż wszystkie
            </button>
          )}
        </div>
        <DataTable data={filteredItems} columns={itemColumns} pageSize={25} />
      </div>
    </div>
  );
}
