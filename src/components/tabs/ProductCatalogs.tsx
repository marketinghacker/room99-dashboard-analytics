'use client';

import { useMemo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import { HeroMetric } from '@/components/primitives/HeroMetric';
import { ScoreCard } from '@/components/primitives/ScoreCard';
import { ChartCard } from '@/components/primitives/ChartCard';
import { ChartBar } from '@/components/primitives/charts';
import { DataTable } from '@/components/primitives/DataTable';
import { PlatformBadge } from '@/components/primitives/PlatformBadge';
import { LoadingCard, ErrorCard, EmptyCard } from '@/components/primitives/StateCard';
import { formatPLN, formatInt, formatPct } from '@/lib/format';

export function ProductCatalogsTab() {
  const { data, error, isLoading } = useFilteredSWR<any>('/api/data/product-catalogs');

  const columns = useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Kampania katalogowa',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <PlatformBadge platform={row.original.platform} />
            <span className="font-medium truncate max-w-[320px]" title={row.original.name}>{row.original.name}</span>
          </div>
        ),
      },
      { accessorKey: 'spend', header: 'Wydatki', meta: { numeric: true }, cell: (i) => formatPLN(i.getValue() as number) },
      { accessorKey: 'impressions', header: 'Wyświetlenia', meta: { numeric: true }, cell: (i) => formatInt(i.getValue() as number) },
      { accessorKey: 'clicks', header: 'Kliki', meta: { numeric: true }, cell: (i) => formatInt(i.getValue() as number) },
      { accessorKey: 'conversionValue', header: 'Wartość konw.', meta: { numeric: true }, cell: (i) => formatPLN(i.getValue() as number) },
      {
        accessorKey: 'roas',
        header: 'ROAS',
        meta: { numeric: true },
        cell: (i) => {
          const v = i.getValue() as number | null;
          return v == null ? '—' : `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(v)}×`;
        },
      },
    ],
    []
  );

  if (isLoading) return <LoadingCard />;
  if (error) return <ErrorCard error={String(error.message ?? error)} />;
  const payload = data?.payload;
  if (!payload) return <ErrorCard error="Brak danych" />;

  const campaigns = payload.campaigns ?? [];
  const totalSpend = campaigns.reduce((s: number, c: any) => s + c.spend, 0);
  const totalRev = campaigns.reduce((s: number, c: any) => s + c.conversionValue, 0);

  if (campaigns.length === 0) {
    return <EmptyCard title="Brak kampanii katalogowych w tym okresie" subtitle="Szukamy: Advantage+, Shopping, Performance Max, Catalog" />;
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      <div>
        <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Katalogi produktów</h2>
        <p className="text-[13px] text-[var(--color-ink-tertiary)] mt-0.5">
          Kampanie oparte o feed produktowy — Advantage+, Shopping, Performance Max, Pinterest Catalog
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger">
        <HeroMetric label="Wydatki" value={totalSpend} format="pln" />
        <HeroMetric label="Wartość konwersji" value={totalRev} format="pln" tone="primary" />
        <HeroMetric
          label="ROAS"
          value={totalSpend > 0 ? totalRev / totalSpend : null}
          format="decimal"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <ScoreCard label="Aktywne kampanie" value={campaigns.length} format="int" />
        <ScoreCard
          label="Średni ROAS"
          value={(() => {
            const withRoas = campaigns.filter((c: any) => c.roas != null);
            return withRoas.length > 0
              ? withRoas.reduce((s: number, c: any) => s + c.roas, 0) / withRoas.length
              : null;
          })()}
          format="decimal"
        />
        <ScoreCard label="Udział w całkowitych wydatkach" value={data?.all?.kpis?.spend ? totalSpend / data.all.kpis.spend : null} format="pct" />
      </div>

      <ChartCard title="Top kampanie po wydatkach" subtitle="Pierwsze 10 kampanii katalogowych">
        <ChartBar
          data={campaigns.slice(0, 10).map((c: any) => ({ name: c.name.slice(0, 30), value: c.spend }))}
          xKey="name"
          yKey="value"
          label="Wydatki"
          money
          horizontal
          height={360}
        />
      </ChartCard>

      <DataTable data={campaigns} columns={columns} pageSize={20} />
    </div>
  );
}
