'use client';

import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import useSWR from 'swr';
import { useFilters } from '@/stores/filters';
import {
  Masthead, HeroKpi, StatCard, SectionHead, Sparkline,
  Delta, Dot, Bar, PLATFORM_DOT, fmtX, fmtPLNCompact,
} from '@/components/primitives/editorial';
import { ChartArea, ChartDonut } from '@/components/primitives/charts';
import { LoadingCard, ErrorCard } from '@/components/primitives/StateCard';
import { formatPLN, formatInt, formatPct } from '@/lib/format';
import { EditableMasthead } from '@/components/shell/EditableMasthead';

const PLATFORM_NAMES: Record<string, string> = {
  meta: 'Meta',
  google_ads: 'Google Ads',
  pinterest: 'Pinterest',
  criteo: 'Criteo',
};

/** Polish month name for masthead kicker. */
const MONTHS_PL = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];

function buildMastheadDefault(range: { start: string; end: string }, revenueDelta: number | null) {
  const start = new Date(range.start);
  const monthName = MONTHS_PL[start.getMonth()];
  const year = start.getFullYear();
  const kicker = `№ 03 · ${monthName} ${year} · Monthly Review`;

  let headline: string;
  if (revenueDelta != null && revenueDelta > 15) {
    headline = `Wiosna wraca do Room99. *Przychód +${revenueDelta.toFixed(1).replace('.', ',')}%* rok do roku.`;
  } else if (revenueDelta != null && revenueDelta > 0) {
    headline = `Stabilny wzrost. *Przychód +${revenueDelta.toFixed(1).replace('.', ',')}%* rok do roku.`;
  } else if (revenueDelta != null && revenueDelta < -5) {
    headline = `Korekta miesiąca. *Przychód ${revenueDelta.toFixed(1).replace('.', ',')}%* rok do roku.`;
  } else {
    headline = `Room99, ${monthName.toLowerCase()} ${year}. *Przegląd miesiąca.*`;
  }

  return { kicker, headline };
}

/** Renders inline-italic segments wrapped in *...* as <em>. */
function renderHeadline(text: string) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((p, i) =>
    p.startsWith('*') && p.endsWith('*') ? <em key={i}>{p.slice(1, -1)}</em> : <span key={i}>{p}</span>,
  );
}

export function ExecutiveSummaryTab() {
  const { period } = useFilters();
  const { data, error, isLoading } = useFilteredSWR<any>('/api/data/executive-summary');
  // Editorial copy override (agency-only edits saved to DB)
  const { data: copy } = useSWR<{ headline?: string; kicker?: string; lede?: string }>('/api/data/editorial-copy?tab=executive');

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger">
        {Array.from({ length: 3 }).map((_, i) => <LoadingCard key={i} />)}
      </div>
    );
  }
  if (error) return <ErrorCard error={String((error as Error).message ?? error)} />;
  if (!data?.all) return <ErrorCard error="Brak danych w cache" />;

  const all = data.all;
  const k = all.kpis;
  const d = all.deltas ?? {};
  const timeSeries = all.timeSeries ?? [];
  const perPlatform = (data.perPlatform ?? []).filter((p: any) => p.platform !== 'ga4' && p.payload);

  // Masthead defaults (dynamic) — agency can override via DB
  const { kicker: defaultKicker, headline: defaultHeadline } = buildMastheadDefault(all.range, d.revenue ?? null);
  const kicker   = copy?.kicker   ?? defaultKicker;
  const headline = copy?.headline ?? defaultHeadline;
  const compareLabel =
    data.compare === 'same_period_last_year' ? 'rok temu' :
    data.compare === 'same_period_last_quarter' ? 'poprzedni kwartał' :
    data.compare === 'none' ? '' :
    'poprzedni okres';
  const lede     = copy?.lede     ?? buildDefaultLede(k, d, compareLabel);

  const spendByPlatform = perPlatform.map((p: any) => ({
    platform: p.platform,
    name: PLATFORM_NAMES[p.platform] ?? p.platform,
    spend: p.payload?.kpis?.spend ?? 0,
    revenue: p.payload?.kpis?.conversionValue ?? 0,
    roas: p.payload?.kpis?.platformRoas ?? null,
    cr: p.payload?.kpis?.clicks > 0 ? (p.payload?.kpis?.conversions ?? 0) / p.payload.kpis.clicks : null,
    cpa: p.payload?.kpis?.conversions > 0 ? (p.payload?.kpis?.spend ?? 0) / p.payload.kpis.conversions : null,
    dailySpend: (p.payload?.timeSeries ?? []).map((r: any) => r.spend),
  })).filter((p: any) => p.spend > 0)
    .sort((a: any, b: any) => b.spend - a.spend);

  const totalSpend = spendByPlatform.reduce((s: number, p: any) => s + p.spend, 0);

  // Funnel data — pull from kpis (GA4) + ads clicks
  const funnelSteps = [
    { label: 'Wyświetlenia',    value: k.impressions ?? 0 },
    { label: 'Kliknięcia',      value: k.clicks ?? 0 },
    { label: 'Sesje',           value: k.sessions ?? 0 },
    { label: 'Dodanie do koszyka', value: k.addToCart ?? 0 },
    { label: 'Checkout',        value: k.beginCheckout ?? 0 },
    { label: 'Zakup',           value: k.transactions ?? 0 },
  ];
  const funnelMax = Math.max(...funnelSteps.map((s) => s.value || 0), 1);

  return (
    <div className="flex flex-col gap-10">
      {/* Masthead */}
      <EditableMasthead
        tab="executive"
        defaultKicker={defaultKicker}
        defaultHeadline={defaultHeadline}
        defaultLede={lede}
      >
        <Masthead
          kicker={kicker}
          title={renderHeadline(headline)}
          lede={lede}
        />
      </EditableMasthead>

      {/* Hero KPI row — 1.25fr 1fr 1fr */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1.25fr 1fr 1fr' }}>
        <HeroKpi
          label="Przychód — Shoper"
          value={k.revenue ?? 0}
          change={d.revenue}
          format="pln"
          primary
          hint="Sklep własny (zakres agencji)"
        />
        <HeroKpi
          label="Wydatki reklamowe"
          value={k.spend ?? 0}
          change={d.spend != null ? -d.spend : null}
          format="pln"
          hint="Meta + Google + Pinterest + Criteo"
        />
        <HeroKpi
          label="ROAS (agency)"
          value={k.roas ?? 0}
          change={d.roas}
          format="x"
          hint="Przychód Shoper / spend"
        />
      </div>

      {/* 6-col stat strip */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <StatCard
          label="Sesje"
          value={k.sessions ?? 0}
          change={d.sessions}
          format="int"
          trend={timeSeries.map((r: any) => r.sessions ?? 0)}
        />
        <StatCard
          label="Transakcje"
          value={k.transactions ?? 0}
          change={d.transactions}
          format="int"
          trend={timeSeries.map((r: any) => r.transactions ?? 0)}
        />
        <StatCard
          label="AOV"
          value={k.aov ?? 0}
          change={d.aov}
          format="pln"
          trend={timeSeries.map((r: any) => (r.transactions ? r.revenue / r.transactions : 0))}
        />
        <StatCard
          label="CR"
          value={k.sessions ? ((k.transactions ?? 0) / k.sessions) * 100 : 0}
          format="pct"
        />
        <StatCard
          label="Nowi użytkownicy"
          value={k.newUsers ?? 0}
          format="int"
        />
        <StatCard
          label="COS (agency)"
          value={k.cos != null ? k.cos * 100 : 0}
          change={d.cos != null ? -d.cos : null}
          format="pct"
        />
      </div>

      {/* §01 Przychód vs Wydatki */}
      <section>
        <SectionHead
          number="§01"
          title="Przychód vs Wydatki"
          sub="Dzień po dniu — Shoper revenue i wszystkie reklamy"
        />
        <div className="grid gap-5" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
          <div className="card p-5">
            <ChartArea
              data={timeSeries}
              series={[
                { key: 'revenue', label: 'Przychód Shoper', color: 'var(--color-accent)' },
                { key: 'spend',   label: 'Wydatki reklamowe', color: 'var(--color-accent-positive)' },
              ]}
              height={280}
            />
          </div>
          <div className="card p-5">
            <div className="overline mb-3">Udział wydatków</div>
            <ChartDonut
              data={spendByPlatform.map((s: any) => ({ name: s.name, value: s.spend }))}
              nameKey="name"
              valueKey="value"
              height={240}
            />
            <div className="mt-3 text-center">
              <div className="overline">Razem</div>
              <div className="numeric mt-0.5" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22 }}>
                {fmtPLNCompact(totalSpend)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* §02 Platformy — zestawienie */}
      <section>
        <SectionHead
          number="§02"
          title="Platformy — zestawienie"
          sub="Wydatki, ROAS, CR, CPA i % budżetu"
        />
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-line-soft)' }}>
                <th className="table-header text-left px-4 py-3">Platforma</th>
                <th className="table-header text-right px-4 py-3">Wydatki</th>
                <th className="table-header text-right px-4 py-3">Przychód (attr.)</th>
                <th className="table-header text-right px-4 py-3">ROAS</th>
                <th className="table-header text-right px-4 py-3">CR</th>
                <th className="table-header text-right px-4 py-3">CPA</th>
                <th className="table-header text-left px-4 py-3">30d trend</th>
                <th className="table-header text-right px-4 py-3">% budżetu</th>
              </tr>
            </thead>
            <tbody>
              {spendByPlatform.map((p: any) => {
                const pct = totalSpend > 0 ? p.spend / totalSpend : 0;
                return (
                  <tr
                    key={p.platform}
                    style={{ borderBottom: '1px solid var(--color-line-soft)' }}
                    className="transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 table-cell">
                        <Dot color={PLATFORM_DOT[p.platform] ?? 'var(--color-accent-2)'} size={8} />
                        <span className="font-medium">{p.name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right table-cell numeric">{formatPLN(p.spend)}</td>
                    <td className="px-4 py-3 text-right table-cell numeric">{formatPLN(p.revenue)}</td>
                    <td className="px-4 py-3 text-right table-cell numeric">{fmtX(p.roas)}</td>
                    <td className="px-4 py-3 text-right table-cell numeric">{formatPct(p.cr)}</td>
                    <td className="px-4 py-3 text-right table-cell numeric">{formatPLN(p.cpa ?? 0)}</td>
                    <td className="px-4 py-3">
                      <Sparkline data={p.dailySpend} width={88} height={20} color={PLATFORM_DOT[p.platform]} />
                    </td>
                    <td className="px-4 py-3 text-right table-cell">
                      <span className="flex items-center justify-end gap-2">
                        <Bar pct={pct} width={60} height={4} color={PLATFORM_DOT[p.platform]} />
                        <span className="numeric">{(pct * 100).toFixed(0)}%</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: 'var(--color-bg-elevated)' }}>
                <td className="px-4 py-3 overline">Razem</td>
                <td className="px-4 py-3 text-right numeric font-medium">{formatPLN(k.spend)}</td>
                <td className="px-4 py-3 text-right numeric font-medium">{formatPLN(k.conversionValue)}</td>
                <td className="px-4 py-3 text-right numeric font-medium">{fmtX(k.platformRoas)}</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right numeric font-medium">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* §03 Pipeline konwersji */}
      <section>
        <SectionHead
          number="§03"
          title="Pipeline konwersji"
          sub="Impressions → Sesje → Dodanie do koszyka → Zakup"
        />
        <div className="card p-6 flex flex-col gap-3">
          {funnelSteps.map((step, i) => {
            const pct = step.value / funnelMax;
            const prev = i > 0 ? funnelSteps[i - 1].value : step.value;
            const retention = prev > 0 ? step.value / prev : null;
            const dropoff = i > 0 && retention != null ? 1 - retention : null;
            return (
              <div key={step.label} className="flex items-center gap-4">
                <div className="w-[180px] shrink-0 flex items-baseline gap-2">
                  <span className="font-mono text-[10px]" style={{ color: 'var(--color-ink-tertiary)', letterSpacing: '0.1em' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[13px]">{step.label}</span>
                </div>
                <div className="flex-1 flex items-center gap-3">
                  <div
                    className="h-8 rounded-[4px] flex items-center justify-end pr-3"
                    style={{
                      width: `${Math.max(4, pct * 100)}%`,
                      background: `color-mix(in oklch, var(--color-accent) ${Math.round(80 - i * 10)}%, var(--color-bg-elevated))`,
                      color: 'white',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 500,
                      fontSize: 14,
                      transition: 'width 700ms cubic-bezier(0.32, 0.72, 0, 1)',
                    }}
                  >
                    {formatInt(step.value)}
                  </div>
                </div>
                <div className="w-[140px] shrink-0 text-right text-[11px]" style={{ color: 'var(--color-ink-tertiary)' }}>
                  {retention != null && <span>{(retention * 100).toFixed(1).replace('.', ',')}% z poprzedniego</span>}
                </div>
                <div className="w-[80px] shrink-0 text-right">
                  {dropoff != null && (
                    <span style={{ color: 'var(--color-accent-negative)', fontSize: 11 }}>
                      −{(dropoff * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}

function buildDefaultLede(k: any, d: any, compareLabel: string): string {
  const revenueDeltaTxt = d.revenue != null ? `${d.revenue > 0 ? '+' : ''}${d.revenue.toFixed(1).replace('.', ',')}%` : '—';
  const cosTxt = k.cos != null ? `${(k.cos * 100).toFixed(2).replace('.', ',')}%` : '—';
  const roasTxt = k.roas != null ? `${k.roas.toFixed(2).replace('.', ',')}×` : '—';
  const vs = compareLabel ? ` vs ${compareLabel}` : '';
  return `Przychód Shoper ${revenueDeltaTxt}${vs}. COS agency ${cosTxt}, ROAS ${roasTxt}. Pełne zestawienie kanałów i lejka poniżej.`;
}
