'use client';

import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import {
  HeroKpi, StatCard, SectionHead,
  Dot, PLATFORM_DOT, fmtPLNCompact, PageHeader,
} from '@/components/primitives/editorial';
import { ChartArea, ChartDonut, ChartLine } from '@/components/primitives/charts';
import { LoadingCard, ErrorCard } from '@/components/primitives/StateCard';
import { formatPct } from '@/lib/format';

const PLATFORM_NAMES: Record<string, string> = {
  meta: 'Meta',
  google_ads: 'Google Ads',
  pinterest: 'Pinterest',
  criteo: 'Criteo',
};

export function ExecutiveSummaryTab() {
  const { data, error, isLoading } = useFilteredSWR<any>('/api/data/executive-summary');

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
  const prev = all.compareKpis;
  const timeSeries = all.timeSeries ?? [];

  // CR — GA4-only: transakcje (GA4) ÷ użytkownicy total (GA4). Potwierdzone
  // z klientem (Michał Holka). Celowo NIE Shoper-transakcje/sesje — definicja
  // widoczna pod kartą, żeby ręczne przeliczenia się zgadzały.
  const crOf = (kp: any): number | null =>
    kp?.users > 0 ? ((kp.ga4Transactions ?? kp.transactions ?? 0) / kp.users) * 100 : null;
  const cr = crOf(k);
  const crPrev = crOf(prev);
  // Fraction, same convention as rollup deltas (0.05 = +5%).
  const crChange = cr != null && crPrev != null && crPrev !== 0 ? (cr - crPrev) / crPrev : null;
  const perPlatform = (data.perPlatform ?? []).filter((p: any) => p.platform !== 'ga4' && p.payload);

  const compareLabel =
    data.compare === 'same_period_last_year' ? 'rok temu' :
    data.compare === 'same_period_last_quarter' ? 'poprzedni kwartał' :
    data.compare === 'none' ? '' :
    'poprzedni okres';
  const lede = buildDefaultLede(k, d, compareLabel);

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

  return (
    <div className="flex flex-col gap-10">
      {/* Jednolity nagłówek — kicker „№ 03 · … · Monthly Review" usunięty (06.2026) */}
      <PageHeader title="Podsumowanie" sub={lede} />

      {/* Hero KPI row — 1.25fr 1fr 1fr */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1.25fr 1fr 1fr' }}>
        <HeroKpi
          label="Przychód — Shoper"
          value={k.revenue ?? 0}
          change={d.revenue}
          format="pln"
          primary
          hint="Źródło: Shoper (sklep własny) · SellRocket reconciled"
        />
        <HeroKpi
          label="Wydatki reklamowe"
          value={k.spend ?? 0}
          change={d.spend != null ? -d.spend : null}
          format="pln"
          hint="Źródło: Meta + Google + Pinterest + Criteo (ads platforms)"
        />
        <HeroKpi
          label="ROAS (agency)"
          value={k.roas ?? 0}
          change={d.roas}
          format="x"
          hint="Przychód Shoper ÷ całkowity spend"
        />
      </div>

      {/* 5-col stat strip — "Nowi użytkownicy" usunięte (decyzja klienta 04.2026) */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <StatCard
          label="Sesje"
          value={k.sessions ?? 0}
          change={d.sessions}
          format="int"
          trend={timeSeries.map((r: any) => r.sessions ?? 0)}
          hint="GA4"
        />
        <StatCard
          label="Transakcje"
          value={k.transactions ?? 0}
          change={d.transactions}
          format="int"
          trend={timeSeries.map((r: any) => r.transactions ?? 0)}
          hint="Shoper — realne zamówienia"
        />
        <StatCard
          label="AOV"
          value={k.aov ?? 0}
          change={d.aov}
          format="pln"
          trend={timeSeries.map((r: any) => (r.transactions ? r.revenue / r.transactions : 0))}
          hint="Shoper: przychód ÷ zamówienia"
        />
        <StatCard
          label="CR"
          value={cr ?? 0}
          change={crChange}
          format="pct"
          hint="GA4: transakcje ÷ użytkownicy (total)"
        />
        <StatCard
          label="COS (agency)"
          value={k.cos != null ? k.cos * 100 : 0}
          change={d.cos != null ? -d.cos : null}
          format="pct"
          hint="(media + wynagrodzenie MH) ÷ przychód Shoper"
        />
      </div>

      {/* §01 Przychód vs Wydatki — koszt (media + fee/dzień) na osi pomocniczej,
          żeby było widać korelację, a nie płaską linię przy skali przychodu */}
      <section>
        <SectionHead
          number="§01"
          title="Przychód vs Wydatki"
          sub="Dzień po dniu. Przychód: Shoper (lewa oś). Koszt: media + wynagrodzenie MH rozbite na dni (prawa oś)."
        />
        <div className="grid gap-5" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
          <div className="card p-5">
            <ChartArea
              data={timeSeries.map((r: any) => ({
                date: r.date,
                revenue: r.revenue,
                cost: (r.spend ?? 0) + (r.spendAgency ?? 0),
              }))}
              series={[
                { key: 'revenue', label: 'Przychód Shoper', color: 'var(--color-accent)' },
                { key: 'cost',    label: 'Koszt marketingu (media + fee)', color: 'var(--color-accent-positive)', axis: 'right' },
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
              height={200}
            />
            {/* % udział per platforma — prośba klienta: „jak już ma być, pokażmy %" */}
            <div className="mt-3 flex flex-col gap-1.5">
              {spendByPlatform.map((p: any) => {
                const pct = totalSpend > 0 ? (p.spend / totalSpend) * 100 : 0;
                return (
                  <div key={p.platform} className="flex items-center gap-2 text-[12px]">
                    <Dot color={PLATFORM_DOT[p.platform] ?? 'var(--color-accent-2)'} size={7} />
                    <span style={{ color: 'var(--color-ink-secondary)' }}>{p.name}</span>
                    <span className="ml-auto numeric font-medium">{pct.toFixed(1).replace('.', ',')}%</span>
                    <span className="numeric w-[88px] text-right" style={{ color: 'var(--color-ink-tertiary)' }}>
                      {fmtPLNCompact(p.spend)}
                    </span>
                  </div>
                );
              })}
              <div
                className="flex items-center justify-between pt-1.5 mt-0.5 text-[12px]"
                style={{ borderTop: '1px solid var(--color-line-soft)' }}
              >
                <span className="overline">Razem</span>
                <span className="numeric font-medium">{fmtPLNCompact(totalSpend)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* §02 COS day-by-day — widać na żywo jak rośnie/spada obciążenie reklamą */}
      <section>
        <SectionHead
          number="§02"
          title="COS dzień po dniu"
          sub="Spend (platformy reklamowe) ÷ Przychód Shoper. Niżej = lepiej. Źródło: ads platforms + Shoper."
          right={
            <div className="flex items-center gap-4 text-[12px]">
              <span style={{ color: 'var(--color-ink-tertiary)' }}>
                Średni COS w okresie:
              </span>
              <span
                className="numeric"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 18,
                }}
              >
                {formatPct(k.cos ?? 0)}
              </span>
            </div>
          }
        />
        <div className="card p-5">
          <ChartLine
            data={(timeSeries as Array<{ date: string; cos?: number }>).map((r) => ({
              date: r.date,
              cos: r.cos != null ? r.cos * 100 : null,
            }))}
            series={[{ key: 'cos', label: 'COS %', color: 'var(--color-accent)' }]}
            height={240}
          />
        </div>
      </section>

      {/* Tabela "Platformy — zestawienie" przeniesiona do zakładki Performance
          (decyzja klienta 04.2026 — za szczegółowa na widok menedżerski). */}

    </div>
  );
}

function buildDefaultLede(k: any, d: any, compareLabel: string): string {
  const revenueDeltaTxt = d.revenue != null ? `${d.revenue > 0 ? '+' : ''}${d.revenue.toFixed(1).replace('.', ',')}%` : '—';
  const cosTxt = k.cos != null ? `${(k.cos * 100).toFixed(2).replace('.', ',')}%` : '—';
  const roasTxt = k.roas != null ? `${k.roas.toFixed(2).replace('.', ',')}×` : '—';
  const vs = compareLabel ? ` vs ${compareLabel}` : '';
  return `Przychód Shoper ${revenueDeltaTxt}${vs}. COS agency ${cosTxt}, ROAS ${roasTxt}. Sprzedaż: Shoper (sklep własny). Wydatki: Meta + Google + Pinterest + Criteo.`;
}
