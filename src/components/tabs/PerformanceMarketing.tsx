'use client';

import { useMemo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import { HeroMetric } from '@/components/primitives/HeroMetric';
import { ScoreCard } from '@/components/primitives/ScoreCard';
import { ChartCard } from '@/components/primitives/ChartCard';
import { ChartArea, ChartBar } from '@/components/primitives/charts';
import { DataTable } from '@/components/primitives/DataTable';
import { PlatformBadge } from '@/components/primitives/PlatformBadge';
import { LoadingCard, ErrorCard } from '@/components/primitives/StateCard';
import { formatPLN, formatInt, formatPct } from '@/lib/format';

const PLATFORM_LABEL: Record<string, string> = {
  meta: 'Meta',
  google_ads: 'Google Ads',
  pinterest: 'Pinterest',
  criteo: 'Criteo',
};

export function PerformanceMarketingTab() {
  const { data, error, isLoading } = useFilteredSWR<any>('/api/data/performance-marketing');

  const columns = useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Kampania',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <PlatformBadge platform={row.original.platform} />
            <span className="font-medium truncate max-w-[280px]" title={row.original.name}>{row.original.name}</span>
          </div>
        ),
      },
      { accessorKey: 'spend', header: 'Wydatki', meta: { numeric: true }, cell: (i) => formatPLN(i.getValue() as number) },
      { accessorKey: 'impressions', header: 'Wyświetlenia', meta: { numeric: true }, cell: (i) => formatInt(i.getValue() as number) },
      { accessorKey: 'clicks', header: 'Kliki', meta: { numeric: true }, cell: (i) => formatInt(i.getValue() as number) },
      { accessorKey: 'ctr', header: 'CTR', meta: { numeric: true }, cell: (i) => formatPct(i.getValue() as number) },
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

  if (isLoading) return <div className="grid grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <LoadingCard key={i} />)}</div>;
  if (error) return <ErrorCard error={String(error.message ?? error)} />;
  if (!data?.all) return <ErrorCard error="Brak danych" />;

  const all = data.all;
  const kpis = all.kpis;
  const deltas = all.deltas ?? {};
  const perPlatform = (data.perPlatform ?? []).filter((p: any) => p.payload);
  const campaigns = all.campaigns ?? [];

  const platformComparison = perPlatform.map((p: any) => ({
    name: PLATFORM_LABEL[p.platform] ?? p.platform,
    spend: p.payload.kpis.spend,
    conversionValue: p.payload.kpis.conversionValue,
    roas: p.payload.kpis.roas ?? 0,
  }));

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 stagger">
        <HeroMetric label="Wydatki (wszystkie kanały)" value={kpis.spend} format="pln" delta={deltas.spend} deltaInverted />
        <HeroMetric label="Wartość konwersji" value={kpis.conversionValue} format="pln" delta={deltas.conversionValue} tone="primary" />
        <HeroMetric label="ROAS" value={kpis.roas} format="decimal" delta={deltas.roas} />
        <HeroMetric label="CPC" value={kpis.cpc} format="pln2" delta={deltas.cpc} deltaInverted />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard label="Wyświetlenia" value={kpis.impressions} format="int" delta={deltas.impressions} />
        <ScoreCard label="Kliki" value={kpis.clicks} format="int" delta={deltas.clicks} />
        <ScoreCard label="CTR" value={kpis.ctr} format="pct" delta={deltas.ctr} />
        <ScoreCard label="CPM" value={kpis.cpm} format="pln2" delta={deltas.cpm} deltaInverted />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Wydatki dzień po dniu" subtitle="Widok łączny wszystkich platform">
          <ChartArea
            data={all.timeSeries ?? []}
            series={[{ key: 'spend', label: 'Wydatki', color: 'var(--color-chart-2)' }]}
            height={260}
          />
        </ChartCard>
        <ChartCard title="Wydatki vs zwrot" subtitle="Po platformie dla wybranego okresu">
          <ChartBar
            data={platformComparison}
            xKey="name"
            yKey="spend"
            label="Wydatki"
            money
            height={260}
          />
        </ChartCard>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[15px] font-semibold">Top kampanie ({campaigns.length})</h3>
          <p className="text-[12px] text-[var(--color-ink-tertiary)]">Sortuj klikając nagłówek</p>
        </div>
        <DataTable data={campaigns} columns={columns} pageSize={20} />
      </div>
    </div>
  );
}
