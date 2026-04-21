'use client';

import { useMemo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import { HeroMetric } from '@/components/primitives/HeroMetric';
import { ScoreCard } from '@/components/primitives/ScoreCard';
import { ChartCard } from '@/components/primitives/ChartCard';
import { ChartArea } from '@/components/primitives/charts';
import { LoadingCard, ErrorCard } from '@/components/primitives/StateCard';
import { DataTable } from '@/components/primitives/DataTable';
import { DeltaBadge } from '@/components/primitives/DeltaBadge';
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

export function PlatformTab({ endpoint, platformLabel, accountHint, accentColor, warningBanner, infoBanner }: PlatformTabProps) {
  const { data, error, isLoading } = useFilteredSWR<any>(endpoint);

  const campaignColumns = useMemo<ColumnDef<CampaignRow, any>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Kampania',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-[var(--color-ink-primary)] truncate max-w-[340px]" title={row.original.name}>
              {row.original.name}
            </span>
            {row.original.status && (
              <span className={cn(
                'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider mt-0.5',
                /ENABLED|ACTIVE|2/.test(row.original.status)
                  ? 'text-[var(--color-accent-positive)]'
                  : /PAUSED|3/.test(row.original.status)
                  ? 'text-[var(--color-ink-tertiary)]'
                  : 'text-[var(--color-ink-tertiary)]'
              )}>
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
      { accessorKey: 'conversionValue', header: 'Wartość', meta: { numeric: true }, cell: (i) => formatPLN(i.getValue() as number) },
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

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      {warningBanner && (
        <div className="card p-4 flex items-start gap-3 border-[var(--color-accent-warning)]/40 bg-[var(--color-accent-warning-bg)]">
          <div className="w-1 h-10 rounded-full bg-[var(--color-accent-warning)]" />
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-[var(--color-ink-primary)]">Pinterest</div>
            <div className="text-[12px] text-[var(--color-ink-secondary)]">{warningBanner}</div>
          </div>
        </div>
      )}

      {infoBanner && (
        <div className="card p-4 flex items-start gap-3 border-[var(--color-accent-primary)]/30 bg-[var(--color-accent-primary)]/5">
          <div className="w-1 h-10 rounded-full bg-[var(--color-accent-primary)]" />
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-[var(--color-ink-primary)]">Informacja</div>
            <div className="text-[12px] text-[var(--color-ink-secondary)]">{infoBanner}</div>
          </div>
        </div>
      )}

      {/* Header strip */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[24px] font-semibold tracking-[-0.02em]" style={accentColor ? { color: accentColor } : undefined}>
            {platformLabel}
          </h2>
          {accountHint && <p className="text-[13px] text-[var(--color-ink-tertiary)] numeric mt-0.5">{accountHint}</p>}
          <p className="text-[11px] text-[var(--color-ink-tertiary)] mt-1 italic">
            Źródło: API platformy · konwersje i wartość raportowane przez platformę (ich własne atrybucja), nie Shoper.
          </p>
        </div>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger">
        <HeroMetric label="Wydatki" value={kpis.spend} format="pln" delta={deltas.spend} deltaInverted />
        <HeroMetric
          label={`Wartość konwersji (${platformLabel})`}
          value={kpis.conversionValue}
          format="pln"
          delta={deltas.conversionValue}
          tone="primary"
          sublabel="Sprzedaż raportowana przez platformę (własna atrybucja)"
        />
        <HeroMetric
          label="ROAS platformy"
          value={kpis.platformRoas}
          format="decimal"
          delta={deltas.platformRoas}
          sublabel={kpis.platformCos != null ? `COS: ${formatPct(kpis.platformCos)} · ${platformLabel} attribution` : undefined}
        />
      </div>

      {/* Agency-scope KPIs (Shoper revenue context) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard
          label="Udział w przychodzie Shopera"
          value={kpis.revenue > 0 ? kpis.spend / kpis.revenue : null}
          format="pct"
          hint={`Wydatki ${platformLabel} / Przychód Shopera`}
          deltaInverted
        />
        <ScoreCard
          label="Wkład w Shoper revenue"
          value={kpis.spend > 0 ? kpis.revenue / kpis.spend : null}
          format="decimal"
          hint="ROAS względem Shoper revenue"
        />
        <ScoreCard label="Konwersje (platforma)" value={kpis.conversions} format="int" delta={deltas.conversions} hint="Atrybucja platformy" />
        <ScoreCard label="Średnia wartość konwersji" value={kpis.conversions > 0 ? kpis.conversionValue / kpis.conversions : null} format="pln" />
      </div>

      {/* Scorecards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <ScoreCard label="Wyświetlenia" value={kpis.impressions} format="int" delta={deltas.impressions} />
        <ScoreCard label="Kliki" value={kpis.clicks} format="int" delta={deltas.clicks} />
        <ScoreCard label="CTR" value={kpis.ctr} format="pct" delta={deltas.ctr} />
        <ScoreCard label="CPC" value={kpis.cpc} format="pln2" delta={deltas.cpc} deltaInverted />
        <ScoreCard label="CPM" value={kpis.cpm} format="pln2" delta={deltas.cpm} deltaInverted />
      </div>

      {/* Time series */}
      <ChartCard title="Wydatki & przychód dzień po dniu" subtitle="Korelacja inwestycji z przychodem Shopera (sklep własny)">
        <ChartArea
          data={payload.timeSeries ?? []}
          series={[
            { key: 'revenue', label: 'Przychód Shoper', color: 'var(--color-chart-3)' },
            { key: 'spend', label: 'Wydatki platformy', color: accentColor ?? 'var(--color-chart-1)' },
          ]}
          height={260}
        />
      </ChartCard>

      {/* Campaigns */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[15px] font-semibold">
            Kampanie ({campaigns.length})
          </h3>
          <p className="text-[12px] text-[var(--color-ink-tertiary)]">
            Sortuj klikając nagłówek • Suma wydatków:{' '}
            <span className="numeric font-semibold text-[var(--color-ink-primary)]">{formatPLN(kpis.spend)}</span>
          </p>
        </div>
        <DataTable data={campaigns} columns={campaignColumns} pageSize={20} />
      </div>
    </div>
  );
}
