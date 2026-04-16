'use client';

import { useMemo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import { HeroMetric } from '@/components/primitives/HeroMetric';
import { DataTable } from '@/components/primitives/DataTable';
import { ChartCard } from '@/components/primitives/ChartCard';
import { ChartBar } from '@/components/primitives/charts';
import { LoadingCard, ErrorCard, EmptyCard } from '@/components/primitives/StateCard';
import { formatPLN, formatInt, formatPct } from '@/lib/format';

export function TopProductsTab() {
  const { data, error, isLoading } = useFilteredSWR<any>('/api/data/top-products');

  const columns = useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Produkt',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium truncate max-w-[360px]" title={row.original.name}>{row.original.name}</span>
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
        id: 'cr',
        header: 'CR',
        meta: { numeric: true },
        cell: ({ row }) => {
          const r = row.original;
          const cr = r.viewed > 0 ? r.purchased / r.viewed : null;
          return formatPct(cr);
        },
      },
    ],
    []
  );

  if (isLoading) return <LoadingCard minHeight={360} />;
  if (error) return <ErrorCard error={String(error.message ?? error)} />;
  const items = data?.items ?? [];
  if (items.length === 0) return <EmptyCard title="Brak danych o produktach" subtitle="GA4 nie zwrócił danych items-level dla tego okresu" />;

  const totalRev = items.reduce((s: number, i: any) => s + i.revenue, 0);
  const totalPurchased = items.reduce((s: number, i: any) => s + i.purchased, 0);
  const top10 = items.slice(0, 10);

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      <div>
        <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Bestsellery</h2>
        <p className="text-[13px] text-[var(--color-ink-tertiary)] mt-0.5">
          Produkty wg przychodu — dane GA4 enhanced ecommerce
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HeroMetric label="Przychód z produktów" value={totalRev} format="pln" tone="primary" />
        <HeroMetric label="Sprzedane sztuki" value={totalPurchased} format="int" />
        <HeroMetric label="Unikalne produkty" value={items.length} format="int" />
      </div>

      <ChartCard title="Top 10 produktów" subtitle="Wg przychodu w wybranym okresie">
        <ChartBar
          data={top10.map((p: any) => ({ name: p.name.slice(0, 28), value: p.revenue }))}
          xKey="name"
          yKey="value"
          label="Przychód"
          money
          horizontal
          height={360}
        />
      </ChartCard>

      <DataTable data={items} columns={columns} pageSize={25} />
    </div>
  );
}
