'use client';

import { useMemo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import { HeroKpi, StatCard, SectionHead, Overline, Dot, PLATFORM_DOT } from '@/components/primitives/editorial';
import { ChartArea, ChartBar } from '@/components/primitives/charts';
import { DataTable } from '@/components/primitives/DataTable';
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
            <Dot color={PLATFORM_DOT[row.original.platform] ?? 'var(--color-accent-2)'} size={8} />
            <span className="text-[11px] font-mono uppercase tracking-[0.08em]" style={{ color: 'var(--color-ink-tertiary)' }}>
              {PLATFORM_LABEL[row.original.platform] ?? row.original.platform}
            </span>
            <span className="font-medium truncate max-w-[280px]" title={row.original.name}>
              {row.original.name}
            </span>
          </div>
        ),
      },
      { accessorKey: 'spend', header: 'Wydatki', meta: { numeric: true }, cell: (i) => formatPLN(i.getValue() as number) },
      { accessorKey: 'impressions', header: 'Wyświetlenia', meta: { numeric: true }, cell: (i) => formatInt(i.getValue() as number) },
      { accessorKey: 'clicks', header: 'Kliki', meta: { numeric: true }, cell: (i) => formatInt(i.getValue() as number) },
      { accessorKey: 'ctr', header: 'CTR', meta: { numeric: true }, cell: (i) => formatPct(i.getValue() as number) },
      { accessorKey: 'conversionValue', header: 'Wartość konw. (platform)', meta: { numeric: true }, cell: (i) => formatPLN(i.getValue() as number) },
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
  const timeSeries = all.timeSeries ?? [];

  const platformComparison = perPlatform.map((p: any) => ({
    name: PLATFORM_LABEL[p.platform] ?? p.platform,
    spend: p.payload.kpis.spend,
    conversionValue: p.payload.kpis.conversionValue,
    roas: p.payload.kpis.roas ?? 0,
  }));

  return (
    <div className="flex flex-col gap-10">
      <header className="mb-0">
        <div className="overline mb-2">Performance Marketing · paid ads combined</div>
        <h1 className="section-title" style={{ fontSize: 32, letterSpacing: '-0.02em', fontWeight: 500 }}>
          Wszystkie kanały płatne
        </h1>
        <p className="lede mt-2" style={{ fontSize: 14 }}>
          Źródło: API platform ads (Meta Graph, Google Ads, Pinterest, Criteo). Wydatki 1:1 z panelami,
          przychód i ROAS to własna atrybucja platform — nie Shoper.
        </p>
      </header>

      {/* Hero KPI */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1.25fr 1fr 1fr 1fr' }}>
        <HeroKpi
          label="Wydatki — wszystkie kanały"
          value={kpis.spend ?? 0}
          change={deltas.spend != null ? -deltas.spend : null}
          format="pln"
          primary
          hint="Źródło: Meta + Google + Pinterest + Criteo"
        />
        <HeroKpi
          label="Wartość konwersji (platform attr.)"
          value={kpis.conversionValue ?? 0}
          change={deltas.conversionValue}
          format="pln"
          hint="Suma własnej atrybucji platform"
        />
        <HeroKpi
          label="ROAS (platform)"
          value={kpis.roas ?? 0}
          change={deltas.roas}
          format="x"
          hint="ConversionValue ÷ Spend"
        />
        <HeroKpi
          label="CPC (średni)"
          value={kpis.cpc ?? 0}
          change={deltas.cpc != null ? -deltas.cpc : null}
          format="pln"
          hint="Koszt za klik"
        />
      </div>

      {/* StatCards strip */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard
          label="Wyświetlenia"
          value={kpis.impressions ?? 0}
          change={deltas.impressions}
          format="int"
          trend={timeSeries.map((r: any) => r.impressions ?? 0)}
        />
        <StatCard
          label="Kliki"
          value={kpis.clicks ?? 0}
          change={deltas.clicks}
          format="int"
          trend={timeSeries.map((r: any) => r.clicks ?? 0)}
        />
        <StatCard label="CTR" value={(kpis.ctr ?? 0) * 100} change={deltas.ctr} format="pct" />
        <StatCard label="CPM" value={kpis.cpm ?? 0} change={deltas.cpm != null ? -deltas.cpm : null} format="pln" />
      </div>

      {/* §01 charts */}
      <section>
        <SectionHead
          number="§01"
          title="Wydatki dzień po dniu"
          sub="Źródło: platformy reklamowe · widok łączny wszystkich kanałów"
        />
        <div className="grid gap-5" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
          <div className="card p-5">
            <ChartArea
              data={timeSeries}
              series={[{ key: 'spend', label: 'Wydatki łączne', color: 'var(--color-accent)' }]}
              height={260}
            />
          </div>
          <div className="card p-5">
            <Overline>Wydatki vs platforma</Overline>
            <div className="mt-3">
              <ChartBar
                data={platformComparison}
                xKey="name"
                yKey="spend"
                label="Wydatki"
                money
                height={220}
              />
            </div>
          </div>
        </div>
      </section>

      {/* §02 campaigns */}
      <section>
        <SectionHead
          number="§02"
          title={`Top kampanie (${campaigns.length})`}
          sub="Źródło: platformy reklamowe · atrybucja własna platform. Sortuj klikając nagłówek."
        />
        <div className="card overflow-hidden">
          <DataTable data={campaigns} columns={columns} pageSize={20} />
        </div>
      </section>
    </div>
  );
}
