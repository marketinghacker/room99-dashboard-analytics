'use client';

import { useMemo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import { HeroKpi, StatCard, SectionHead, Dot, PLATFORM_DOT } from '@/components/primitives/editorial';
import { ChartBar } from '@/components/primitives/charts';
import { DataTable } from '@/components/primitives/DataTable';
import { LoadingCard, ErrorCard, EmptyCard } from '@/components/primitives/StateCard';
import { formatPLN, formatInt, formatPct } from '@/lib/format';

const PLATFORM_LABEL: Record<string, string> = {
  meta: 'Meta',
  google_ads: 'Google Ads',
  pinterest: 'Pinterest',
  criteo: 'Criteo',
};

export function ProductCatalogsTab() {
  const { data, error, isLoading } = useFilteredSWR<any>('/api/data/product-catalogs');

  const columns = useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Kampania katalogowa',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Dot color={PLATFORM_DOT[row.original.platform] ?? 'var(--color-accent-2)'} size={8} />
            <span className="text-[11px] font-mono uppercase tracking-[0.08em]" style={{ color: 'var(--color-ink-tertiary)' }}>
              {PLATFORM_LABEL[row.original.platform] ?? row.original.platform}
            </span>
            <span className="font-medium truncate max-w-[300px]" title={row.original.name}>
              {row.original.name}
            </span>
          </div>
        ),
      },
      { accessorKey: 'spend', header: 'Wydatki', meta: { numeric: true }, cell: (i) => formatPLN(i.getValue() as number) },
      { accessorKey: 'impressions', header: 'Wyświetlenia', meta: { numeric: true }, cell: (i) => formatInt(i.getValue() as number) },
      { accessorKey: 'clicks', header: 'Kliki', meta: { numeric: true }, cell: (i) => formatInt(i.getValue() as number) },
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

  if (isLoading) return <LoadingCard />;
  if (error) return <ErrorCard error={String(error.message ?? error)} />;
  const payload = data?.payload;
  if (!payload) return <ErrorCard error="Brak danych" />;

  const campaigns = payload.campaigns ?? [];
  const totalSpend = campaigns.reduce((s: number, c: any) => s + c.spend, 0);
  const totalRev = campaigns.reduce((s: number, c: any) => s + c.conversionValue, 0);
  const avgRoasRow = (() => {
    const withRoas = campaigns.filter((c: any) => c.roas != null);
    return withRoas.length > 0
      ? withRoas.reduce((s: number, c: any) => s + c.roas, 0) / withRoas.length
      : 0;
  })();
  const allSpend = data?.all?.kpis?.spend ?? 0;

  if (campaigns.length === 0) {
    return <EmptyCard title="Brak kampanii katalogowych w tym okresie" subtitle="Szukamy: Advantage+, Shopping, Performance Max, Catalog" />;
  }

  return (
    <div className="flex flex-col gap-10">
      <header>
        <div className="overline mb-2">Katalogi produktów · feed-driven</div>
        <h1 className="section-title" style={{ fontSize: 32, letterSpacing: '-0.02em', fontWeight: 500 }}>
          Katalogi produktów
        </h1>
        <p className="lede mt-2" style={{ fontSize: 14 }}>
          Źródło: Meta Advantage+ Catalog, Google Shopping / Performance Max, Pinterest Catalog, Criteo feed.
          Wartość konwersji raportowana przez platformy (własna atrybucja), nie Shoper.
        </p>
      </header>

      {/* Hero KPI */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1.25fr 1fr 1fr' }}>
        <HeroKpi
          label="Wartość konwersji (platform)"
          value={totalRev}
          format="pln"
          primary
          hint="Suma własnej atrybucji platform"
        />
        <HeroKpi
          label="Wydatki na katalogi"
          value={totalSpend}
          format="pln"
          hint="Źródło: platformy reklamowe"
        />
        <HeroKpi
          label="ROAS (platform)"
          value={totalSpend > 0 ? totalRev / totalSpend : 0}
          format="x"
          hint="ConversionValue ÷ Spend"
        />
      </div>

      {/* Stat strip */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <StatCard label="Aktywne kampanie" value={campaigns.length} format="int" />
        <StatCard label="Średni ROAS (kampania)" value={avgRoasRow} format="x" />
        <StatCard
          label="Udział w wydatkach performance"
          value={allSpend > 0 ? (totalSpend / allSpend) * 100 : 0}
          format="pct"
        />
      </div>

      {/* §01 top campaigns chart */}
      <section>
        <SectionHead
          number="§01"
          title="Top kampanie po wydatkach"
          sub="Źródło: platform ads API · pierwsze 10 kampanii katalogowych"
        />
        <div className="card p-5">
          <ChartBar
            data={campaigns.slice(0, 10).map((c: any) => ({ name: c.name.slice(0, 30), value: c.spend }))}
            xKey="name"
            yKey="value"
            label="Wydatki"
            money
            horizontal
            height={360}
          />
        </div>
      </section>

      {/* §02 table */}
      <section>
        <SectionHead
          number="§02"
          title={`Kampanie katalogowe (${campaigns.length})`}
          sub="Źródło: platform ads API · sortuj klikając nagłówek"
        />
        <div className="card overflow-hidden">
          <DataTable data={campaigns} columns={columns} pageSize={20} />
        </div>
      </section>
    </div>
  );
}
