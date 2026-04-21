'use client';

import { useMemo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import { HeroKpi, StatCard, SectionHead, Overline } from '@/components/primitives/editorial';
import { ChartArea } from '@/components/primitives/charts';
import { LoadingCard, ErrorCard } from '@/components/primitives/StateCard';
import { DataTable } from '@/components/primitives/DataTable';
import { formatPLN, formatPLN2, formatInt, formatPct } from '@/lib/format';
import { cn } from '@/components/ui/cn';

export type PlatformTabProps = {
  endpoint: string;
  platformLabel: string;
  accountHint?: string;
  accentColor?: string;
  warningBanner?: string | null;
  infoBanner?: string | null;
  objective?: 'pln' | 'roas';
};

type CampaignRow = {
  platform: string;
  id: string;
  name: string;
  status: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cos: number | null;
  roas: number | null;
};

export function PlatformTab({
  endpoint,
  platformLabel,
  accountHint,
  accentColor,
  warningBanner,
  infoBanner,
}: PlatformTabProps) {
  const { data, error, isLoading } = useFilteredSWR<any>(endpoint);

  const campaignColumns = useMemo<ColumnDef<CampaignRow, any>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Kampania',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium truncate max-w-[340px]" title={row.original.name}>
              {row.original.name}
            </span>
            {row.original.status && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider mt-0.5',
                  /ENABLED|ACTIVE|2/.test(row.original.status)
                    ? 'text-[var(--color-accent-positive)]'
                    : 'text-[var(--color-ink-tertiary)]',
                )}
              >
                <span className="w-1 h-1 rounded-full bg-current" /> {row.original.status}
              </span>
            )}
          </div>
        ),
      },
      { accessorKey: 'spend', header: 'Wydatki', meta: { numeric: true }, cell: (i) => formatPLN(i.getValue() as number) },
      { accessorKey: 'impressions', header: 'Wyświetlenia', meta: { numeric: true }, cell: (i) => formatInt(i.getValue() as number) },
      { accessorKey: 'clicks', header: 'Kliki', meta: { numeric: true }, cell: (i) => formatInt(i.getValue() as number) },
      { accessorKey: 'ctr', header: 'CTR', meta: { numeric: true }, cell: (i) => formatPct(i.getValue() as number) },
      { accessorKey: 'cpc', header: 'CPC', meta: { numeric: true }, cell: (i) => formatPLN2(i.getValue() as number) },
      { accessorKey: 'conversions', header: 'Konwersje', meta: { numeric: true }, cell: (i) => formatInt(Math.round((i.getValue() as number) ?? 0)) },
      { accessorKey: 'conversionValue', header: 'Wartość (platform)', meta: { numeric: true }, cell: (i) => formatPLN(i.getValue() as number) },
      {
        accessorKey: 'roas',
        header: 'ROAS',
        meta: { numeric: true },
        cell: (i) => {
          const v = i.getValue() as number | null;
          if (v == null) return '—';
          return `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(v)}×`;
        },
      },
    ],
    [],
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <LoadingCard key={i} />)}
      </div>
    );
  }
  if (error) return <ErrorCard error={String(error.message ?? error)} />;

  const payload = data?.payload ?? data?.all ?? null;
  if (!payload) return <ErrorCard error="Brak danych w cache" />;

  const kpis = payload.kpis;
  const deltas = payload.deltas ?? {};
  const campaigns: CampaignRow[] = payload.campaigns ?? [];
  const timeSeries = payload.timeSeries ?? [];

  return (
    <div className="flex flex-col gap-10">
      {warningBanner && (
        <div
          className="card p-4 flex items-start gap-3"
          style={{
            background: 'var(--color-accent-warning-bg)',
            border: '1px solid color-mix(in oklch, var(--color-accent-warning) 40%, transparent)',
          }}
        >
          <div className="w-1 min-h-[40px] rounded-full" style={{ background: 'var(--color-accent-warning)' }} />
          <div className="flex-1">
            <div className="text-[13px] font-semibold">{platformLabel}</div>
            <div className="text-[12px]" style={{ color: 'var(--color-ink-secondary)' }}>{warningBanner}</div>
          </div>
        </div>
      )}

      {infoBanner && (
        <div
          className="card p-4 flex items-start gap-3"
          style={{
            background: 'color-mix(in oklch, var(--color-accent) 6%, var(--color-bg-card))',
            border: '1px solid color-mix(in oklch, var(--color-accent) 25%, transparent)',
          }}
        >
          <div className="w-1 min-h-[40px] rounded-full" style={{ background: 'var(--color-accent)' }} />
          <div className="flex-1">
            <div className="text-[13px] font-semibold">Informacja</div>
            <div className="text-[12px]" style={{ color: 'var(--color-ink-secondary)' }}>{infoBanner}</div>
          </div>
        </div>
      )}

      <header>
        <div className="overline mb-2">Platforma · paid ads</div>
        <h1
          className="section-title"
          style={{
            fontSize: 32,
            letterSpacing: '-0.02em',
            fontWeight: 500,
            color: accentColor ?? 'var(--color-ink-primary)',
          }}
        >
          {platformLabel}
        </h1>
        {accountHint && (
          <p className="text-[13px] numeric mt-1" style={{ color: 'var(--color-ink-tertiary)' }}>
            {accountHint}
          </p>
        )}
        <p className="lede mt-2" style={{ fontSize: 14 }}>
          Źródło: API {platformLabel} · konwersje i wartość raportowane przez platformę (własna atrybucja),
          nie Shoper. Wydatki 1:1 z panelem reklamowym.
        </p>
      </header>

      {/* Hero KPIs */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1.25fr 1fr 1fr' }}>
        <HeroKpi
          label={`Wartość konwersji (${platformLabel})`}
          value={kpis.conversionValue ?? 0}
          change={deltas.conversionValue}
          format="pln"
          primary
          hint="Sprzedaż raportowana przez platformę (własna atrybucja)"
        />
        <HeroKpi
          label="Wydatki"
          value={kpis.spend ?? 0}
          change={deltas.spend != null ? -deltas.spend : null}
          format="pln"
          hint={`Źródło: ${platformLabel} ads API`}
        />
        <HeroKpi
          label="ROAS (platform)"
          value={kpis.platformRoas ?? 0}
          change={deltas.platformRoas}
          format="x"
          hint={kpis.platformCos != null ? `COS: ${formatPct(kpis.platformCos)}` : `${platformLabel} attribution`}
        />
      </div>

      {/* Agency-scope comparison: platform spend vs Shoper revenue */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard
          label="Udział w przychodzie Shopera"
          value={kpis.revenue > 0 ? (kpis.spend / kpis.revenue) * 100 : 0}
          format="pct"
        />
        <StatCard
          label="Wkład ROAS Shoper"
          value={kpis.spend > 0 ? kpis.revenue / kpis.spend : 0}
          format="x"
        />
        <StatCard
          label="Konwersje (platform)"
          value={kpis.conversions ?? 0}
          change={deltas.conversions}
          format="int"
        />
        <StatCard
          label="Śr. wartość konwersji"
          value={kpis.conversions > 0 ? kpis.conversionValue / kpis.conversions : 0}
          format="pln"
        />
      </div>

      {/* Detail strip */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <StatCard label="Wyświetlenia" value={kpis.impressions ?? 0} change={deltas.impressions} format="int" />
        <StatCard label="Kliki" value={kpis.clicks ?? 0} change={deltas.clicks} format="int" />
        <StatCard label="CTR" value={(kpis.ctr ?? 0) * 100} change={deltas.ctr} format="pct" />
        <StatCard label="CPC" value={kpis.cpc ?? 0} change={deltas.cpc != null ? -deltas.cpc : null} format="pln" />
        <StatCard label="CPM" value={kpis.cpm ?? 0} change={deltas.cpm != null ? -deltas.cpm : null} format="pln" />
      </div>

      {/* §01 Time series */}
      <section>
        <SectionHead
          number="§01"
          title="Wydatki & przychód dzień po dniu"
          sub={`Źródło: ${platformLabel} ads API (wydatki) + Shoper (przychód dzienny)`}
        />
        <div className="card p-5">
          <ChartArea
            data={timeSeries}
            series={[
              { key: 'revenue', label: 'Przychód Shoper', color: 'var(--color-accent)' },
              { key: 'spend', label: `Wydatki ${platformLabel}`, color: accentColor ?? 'var(--color-accent-2)' },
            ]}
            height={260}
          />
        </div>
      </section>

      {/* §02 campaigns */}
      <section>
        <SectionHead
          number="§02"
          title={`Kampanie (${campaigns.length})`}
          sub="Źródło: platform ads API · atrybucja własna platformy. Sortuj klikając nagłówek."
          right={
            <div className="text-[11px] flex items-baseline gap-2" style={{ color: 'var(--color-ink-tertiary)' }}>
              <Overline>Suma wydatków:</Overline>
              <span className="numeric font-medium" style={{ color: 'var(--color-ink-primary)' }}>
                {formatPLN(kpis.spend)}
              </span>
            </div>
          }
        />
        <div className="card overflow-hidden">
          <DataTable data={campaigns} columns={campaignColumns} pageSize={20} />
        </div>
      </section>
    </div>
  );
}
