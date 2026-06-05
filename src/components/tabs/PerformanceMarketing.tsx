'use client';

import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import { HeroKpi, StatCard, SectionHead, Overline, Dot, PLATFORM_DOT, fmtX, Bar } from '@/components/primitives/editorial';
import { ChartArea, ChartBar } from '@/components/primitives/charts';
import { DeltaBadge } from '@/components/primitives/DeltaBadge';
import { LoadingCard, ErrorCard } from '@/components/primitives/StateCard';
import { formatPLN, formatPct } from '@/lib/format';

const PLATFORM_LABEL: Record<string, string> = {
  meta: 'Meta',
  google_ads: 'Google Ads',
  pinterest: 'Pinterest',
  criteo: 'Criteo',
};

export function PerformanceMarketingTab() {
  const { data, error, isLoading } = useFilteredSWR<any>('/api/data/performance-marketing');

  if (isLoading) return <div className="grid grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <LoadingCard key={i} />)}</div>;
  if (error) return <ErrorCard error={String(error.message ?? error)} />;
  if (!data?.all) return <ErrorCard error="Brak danych" />;

  const all = data.all;
  const kpis = all.kpis;
  const deltas = all.deltas ?? {};
  const prev = all.compareKpis;
  const perPlatform = (data.perPlatform ?? []).filter((p: any) => p.payload && p.platform !== 'ga4');
  const timeSeries = all.timeSeries ?? [];

  // Udział mediów w przychodzie = spend (media, bez fee) / przychód Shoper.
  // Prośba klienta — zastępuje usunięte „Wartość konwersji" i „ROAS" (duplikowały
  // sekcję platform attribution).
  const mediaShare = kpis.revenue > 0 ? kpis.spend / kpis.revenue : null;
  const prevMediaShare = prev?.revenue > 0 ? prev.spend / prev.revenue : null;
  const mediaShareChange =
    mediaShare != null && prevMediaShare != null && prevMediaShare !== 0
      ? (mediaShare - prevMediaShare) / prevMediaShare
      : null;

  // Per-platform rows for the two draft tables. Each platform payload carries
  // its own deltas vs the selected compare period.
  const rows = perPlatform
    .map((p: any) => {
      const k = p.payload.kpis ?? {};
      const d = p.payload.deltas ?? {};
      return {
        platform: p.platform,
        name: PLATFORM_LABEL[p.platform] ?? p.platform,
        spend: k.spend ?? 0,
        spendDelta: d.spend ?? null,
        revenue: k.conversionValue ?? 0,
        roas: k.platformRoas ?? null,
        roasDelta: d.platformRoas ?? null,
        cpa: k.conversions > 0 ? (k.spend ?? 0) / k.conversions : null,
        cr: k.clicks > 0 ? (k.conversions ?? 0) / k.clicks : null,
      };
    })
    .filter((r: any) => r.spend > 0)
    .sort((a: any, b: any) => b.spend - a.spend);

  const totalSpend = rows.reduce((s: number, r: any) => s + r.spend, 0);

  const platformComparison = rows.map((r: any) => ({ name: r.name, spend: r.spend }));

  return (
    <div className="flex flex-col gap-10">
      <header className="mb-0">
        <div className="overline mb-2">Performance Marketing · paid ads combined</div>
        <h1 className="section-title" style={{ fontSize: 32, letterSpacing: '-0.02em', fontWeight: 500 }}>
          Wszystkie kanały płatne
        </h1>
        <p className="lede mt-2" style={{ fontSize: 14 }}>
          Źródło: API platform ads (Meta Graph, Google Ads, Pinterest, Criteo). Wydatki 1:1 z panelami.
          Przychody platform NIE są sumowane — każda platforma raportuje własną atrybucję.
        </p>
      </header>

      {/* Hero KPI — „Wartość konwersji" i „ROAS" usunięte (duplikowały dane platform);
          w zamian „Udział mediów w przychodzie" (prośba klienta). */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1.5fr 1.25fr 1fr' }}>
        <HeroKpi
          label="Wydatki — wszystkie kanały"
          value={kpis.spend ?? 0}
          change={deltas.spend != null ? -deltas.spend : null}
          format="pln"
          primary
          hint="Źródło: Meta + Google + Pinterest + Criteo"
        />
        <HeroKpi
          label="Udział mediów w przychodzie"
          value={mediaShare != null ? mediaShare * 100 : 0}
          change={mediaShareChange != null ? -mediaShareChange : null}
          format="pct"
          hint="Wydatki media ÷ przychód Shoper (bez wynagrodzenia MH)"
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

      {/* §02 Budżet i udział platform — zestawienie 1/2 z draftu */}
      <section>
        <SectionHead
          number="§02"
          title="Budżet i udział platform"
          sub="Wydatki 1:1 z paneli reklamowych. Zmiana vs wybrany okres porównawczy."
        />
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-line-soft)' }}>
                <th className="table-header text-left px-4 py-3">Platforma</th>
                <th className="table-header text-right px-4 py-3">Wydatki</th>
                <th className="table-header text-right px-4 py-3">% udział</th>
                <th className="table-header text-right px-4 py-3">Zmiana</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const pct = totalSpend > 0 ? r.spend / totalSpend : 0;
                return (
                  <tr
                    key={r.platform}
                    style={{ borderBottom: '1px solid var(--color-line-soft)' }}
                    className="transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 table-cell">
                        <Dot color={PLATFORM_DOT[r.platform] ?? 'var(--color-accent-2)'} size={8} />
                        <span className="font-medium">{r.name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right table-cell numeric">{formatPLN(r.spend)}</td>
                    <td className="px-4 py-3 text-right table-cell">
                      <span className="flex items-center justify-end gap-2">
                        <Bar pct={pct} width={60} height={4} color={PLATFORM_DOT[r.platform]} />
                        <span className="numeric">{(pct * 100).toFixed(0)}%</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeltaBadge pct={r.spendDelta} size="xs" />
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: 'var(--color-bg-elevated)' }}>
                <td className="px-4 py-3 overline">Łącznie</td>
                <td className="px-4 py-3 text-right numeric font-medium">{formatPLN(totalSpend)}</td>
                <td className="px-4 py-3 text-right numeric font-medium">100%</td>
                <td className="px-4 py-3 text-right">
                  <DeltaBadge pct={deltas.spend ?? null} size="xs" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* §03 Efektywność platform — zestawienie 2/2 z draftu.
          UWAGA: bez wiersza „Razem" — przychodów z różnych atrybucji NIE sumujemy. */}
      <section>
        <SectionHead
          number="§03"
          title="Efektywność platform"
          sub="Przychód = własna atrybucja każdej platformy (nie Shoper) — wartości NIE sumują się między platformami."
        />
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-line-soft)' }}>
                <th className="table-header text-left px-4 py-3">Platforma</th>
                <th className="table-header text-right px-4 py-3">Przychód (platform attr.)</th>
                <th className="table-header text-right px-4 py-3">ROAS</th>
                <th className="table-header text-right px-4 py-3">CPA</th>
                <th className="table-header text-right px-4 py-3">CR</th>
                <th className="table-header text-right px-4 py-3">Zmiana ROAS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr
                  key={r.platform}
                  style={{ borderBottom: '1px solid var(--color-line-soft)' }}
                  className="transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 table-cell">
                      <Dot color={PLATFORM_DOT[r.platform] ?? 'var(--color-accent-2)'} size={8} />
                      <span className="font-medium">{r.name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right table-cell numeric">{formatPLN(r.revenue)}</td>
                  <td className="px-4 py-3 text-right table-cell numeric font-medium">{fmtX(r.roas)}</td>
                  <td className="px-4 py-3 text-right table-cell numeric">{r.cpa != null ? formatPLN(r.cpa) : '—'}</td>
                  <td className="px-4 py-3 text-right table-cell numeric">{formatPct(r.cr)}</td>
                  <td className="px-4 py-3 text-right">
                    <DeltaBadge pct={r.roasDelta} size="xs" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
