'use client';

import { useFilteredSWR } from '@/components/primitives/useFilteredSWR';
import { HeroKpi, StatCard, SectionHead, Overline } from '@/components/primitives/editorial';
import { ChartBar, ChartDonut, ChartLine } from '@/components/primitives/charts';
import { LoadingCard, ErrorCard } from '@/components/primitives/StateCard';
import { formatPLN, formatInt, formatPct } from '@/lib/format';

type ChannelFull = {
  channelGroup: string;
  sessions: number;
  users: number;
  addToCart: number;
  transactions: number;
  revenue: number;
};

type WowRow = {
  channelGroup: string;
  crDeltaPp: number | null;
  revenueDelta: number | null;
  sessionsDelta: number | null;
};

/** Zmiana w punktach procentowych — konwencja klienta dla CR. */
function PpBadge({ pp }: { pp: number | null }) {
  if (pp == null) return <span style={{ color: 'var(--color-ink-tertiary)' }}>—</span>;
  const good = pp >= 0;
  return (
    <span
      className="numeric text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
      style={{
        color: good ? 'var(--color-accent-positive)' : 'var(--color-accent-negative)',
        background: good ? 'var(--color-accent-positive-bg)' : 'var(--color-accent-negative-bg)',
      }}
    >
      {good ? '↑' : '↓'} {Math.abs(pp).toFixed(2).replace('.', ',')} pp
    </span>
  );
}

export function TrafficSourcesTab() {
  const { data, error, isLoading } = useFilteredSWR<any>('/api/data/traffic-sources');

  if (isLoading) return <LoadingCard />;
  if (error) return <ErrorCard error={String(error.message ?? error)} />;
  if (!data?.channels) return <ErrorCard error="Brak danych GA4" />;

  const k = data.kpis;
  const prev = data.compareKpis;
  const channelsFull: ChannelFull[] = (data.channelsFull ?? []).slice().sort((a: ChannelFull, b: ChannelFull) => b.sessions - a.sessions);
  const wowRows: WowRow[] = data.wow?.rows ?? [];
  const wowByChannel = new Map(wowRows.map((w) => [w.channelGroup, w]));
  const totalRevenue = channelsFull.reduce((s, c) => s + c.revenue, 0);

  // CR — definicja klienta: transakcje GA4 ÷ użytkownicy GA4 (total).
  const crOf = (kp: any): number | null =>
    kp?.users > 0 ? (kp.ga4Transactions ?? kp.transactions ?? 0) / kp.users : null;
  const cr = crOf(k);
  const crPrev = crOf(prev);
  const crChange = cr != null && crPrev != null && crPrev !== 0 ? (cr - crPrev) / crPrev : null;

  // Trendy CR — pivot tygodni na serie per kanał (top 6 wg sesji).
  const topChannels = channelsFull.slice(0, 6).map((c) => c.channelGroup);
  const weeks = Array.from(new Set((data.crTrends ?? []).map((r: any) => r.week))).sort() as string[];
  const trendData = weeks.map((week) => {
    const row: Record<string, any> = { week };
    for (const r of data.crTrends ?? []) {
      if (r.week === week && topChannels.includes(r.channelGroup) && r.cr != null) {
        row[r.channelGroup] = r.cr * 100;
      }
    }
    return row;
  });
  const trendSeries = topChannels.map((ch, i) => ({
    key: ch,
    label: ch,
    color: `var(--color-chart-${(i % 8) + 1})`,
  }));

  return (
    <div className="flex flex-col gap-10">
      <header>
        <div className="overline mb-2">Ruch · GA4 acquisition</div>
        <h1 className="section-title" style={{ fontSize: 32, letterSpacing: '-0.02em', fontWeight: 500 }}>
          Źródła ruchu
        </h1>
        <p className="lede mt-2" style={{ fontSize: 14 }}>
          Źródło: Google Analytics 4 · kanały pozyskiwania, sesje, przychód transakcyjny.
          Przychód GA4 może różnić się od Shoper (attribution window, refunds).
        </p>
      </header>

      <div className="grid gap-5" style={{ gridTemplateColumns: '1.25fr 1fr 1fr' }}>
        <HeroKpi
          label="Sesje"
          value={k.sessions ?? 0}
          format="int"
          primary
          hint="Źródło: GA4"
        />
        <HeroKpi
          label="Użytkownicy"
          value={k.users ?? 0}
          format="int"
          hint={k.newUsers && k.users ? `${formatPct(k.newUsers / k.users)} nowi` : 'Źródło: GA4'}
        />
        <HeroKpi
          label="Szybka konwersja (CR)"
          value={cr != null ? cr * 100 : 0}
          change={crChange}
          format="pct"
          hint="GA4: transakcje ÷ użytkownicy (total)"
        />
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard label="Nowi użytkownicy" value={k.newUsers ?? 0} format="int" />
        <StatCard label="Engaged sessions" value={k.engagedSessions ?? 0} format="int" />
        <StatCard label="Transakcje (GA4)" value={k.ga4Transactions ?? k.transactions ?? 0} format="int" hint="GA4 — do CR; realne sprzedaże → Shoper" />
        <StatCard label="Bounce rate" value={(k.bounceRate ?? 0) * 100} format="pct" />
      </div>

      <section>
        <SectionHead
          number="§01"
          title="Sesje vs przychód wg kanału"
          sub="Źródło: GA4 · default channel grouping"
        />
        <div className="grid gap-5" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
          <div className="card p-5">
            <Overline>Sesje wg kanału</Overline>
            <div className="mt-3">
              <ChartBar
                data={channelsFull.map((c) => ({ name: c.channelGroup, sessions: c.sessions }))}
                xKey="name"
                yKey="sessions"
                label="Sesje"
                horizontal
                height={Math.max(240, channelsFull.length * 32 + 40)}
              />
            </div>
          </div>
          <div className="card p-5">
            <Overline>Przychód wg kanału</Overline>
            <div className="mt-3">
              <ChartDonut
                data={channelsFull.filter((c) => c.revenue > 0).map((c) => ({ name: c.channelGroup, value: c.revenue }))}
                nameKey="name"
                valueKey="value"
                height={280}
              />
            </div>
          </div>
        </div>
      </section>

      {/* §02 Performance kanałów — odwzorowanie draftu: pełna ścieżka zakupowa
          per kanał + Zmiana CR wg złotej reguły WoW (7d vs 7d, niezależnie od filtra). */}
      <section>
        <SectionHead
          number="§02"
          title="Performance kanałów"
          sub={`CR = transakcje ÷ użytkownicy (GA4). Zmiana CR: WoW — ${data.wow?.last7?.start} → ${data.wow?.last7?.end} vs poprzednie 7 dni.`}
        />
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-line-soft)' }}>
                <th className="table-header text-left px-4 py-3">Kanał</th>
                <th className="table-header text-right px-4 py-3">Sesje</th>
                <th className="table-header text-right px-4 py-3">Dodanie do koszyka</th>
                <th className="table-header text-right px-4 py-3">Zakup</th>
                <th className="table-header text-right px-4 py-3">CR</th>
                <th className="table-header text-right px-4 py-3">Przychód (GA4)</th>
                <th className="table-header text-right px-4 py-3">Zmiana CR (WoW)</th>
              </tr>
            </thead>
            <tbody>
              {channelsFull.map((c) => {
                const chCr = c.users > 0 ? c.transactions / c.users : null;
                const w = wowByChannel.get(c.channelGroup);
                return (
                  <tr
                    key={c.channelGroup}
                    style={{ borderBottom: '1px solid var(--color-line-soft)' }}
                    className="transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-4 py-3 table-cell font-medium">{c.channelGroup}</td>
                    <td className="px-4 py-3 text-right numeric table-cell">{formatInt(c.sessions)}</td>
                    <td className="px-4 py-3 text-right numeric table-cell">{formatInt(c.addToCart)}</td>
                    <td className="px-4 py-3 text-right numeric table-cell">{formatInt(c.transactions)}</td>
                    <td className="px-4 py-3 text-right numeric table-cell">{chCr != null ? formatPct(chCr) : '—'}</td>
                    <td className="px-4 py-3 text-right numeric table-cell">{formatPLN(c.revenue)}</td>
                    <td className="px-4 py-3 text-right"><PpBadge pp={w?.crDeltaPp ?? null} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* §03 Udział kanałów w przychodzie — odwzorowanie draftu */}
      <section>
        <SectionHead
          number="§03"
          title="Udział kanałów w przychodzie"
          sub="Przychód transakcyjny GA4 w wybranym okresie. Zmiana: WoW (7d vs 7d)."
        />
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-line-soft)' }}>
                <th className="table-header text-left px-4 py-3">Kanał</th>
                <th className="table-header text-right px-4 py-3">Przychód</th>
                <th className="table-header text-right px-4 py-3">% udział</th>
                <th className="table-header text-right px-4 py-3">Zmiana WoW</th>
              </tr>
            </thead>
            <tbody>
              {channelsFull
                .filter((c) => c.revenue > 0)
                .sort((a, b) => b.revenue - a.revenue)
                .map((c) => {
                  const w = wowByChannel.get(c.channelGroup);
                  const share = totalRevenue > 0 ? c.revenue / totalRevenue : 0;
                  const rd = w?.revenueDelta;
                  return (
                    <tr
                      key={c.channelGroup}
                      style={{ borderBottom: '1px solid var(--color-line-soft)' }}
                      className="transition-colors"
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-4 py-3 table-cell font-medium">{c.channelGroup}</td>
                      <td className="px-4 py-3 text-right numeric table-cell">{formatPLN(c.revenue)}</td>
                      <td className="px-4 py-3 text-right numeric table-cell">{formatPct(share)}</td>
                      <td className="px-4 py-3 text-right table-cell">
                        {rd == null ? (
                          <span style={{ color: 'var(--color-ink-tertiary)' }}>—</span>
                        ) : (
                          <span
                            className="numeric text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              color: rd >= 0 ? 'var(--color-accent-positive)' : 'var(--color-accent-negative)',
                              background: rd >= 0 ? 'var(--color-accent-positive-bg)' : 'var(--color-accent-negative-bg)',
                            }}
                          >
                            {rd >= 0 ? '↑' : '↓'} {Math.abs(rd * 100).toFixed(1).replace('.', ',')}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {/* §04 Trendy CR według kanałów — wykres liniowy z draftu */}
      <section>
        <SectionHead
          number="§04"
          title="Trendy współczynnika konwersji według kanałów"
          sub="CR tygodniowo (transakcje ÷ użytkownicy, GA4) · top 6 kanałów wg sesji · ostatnie 12 tygodni"
        />
        <div className="card p-5">
          <ChartLine
            data={trendData}
            xKey="week"
            series={trendSeries}
            height={300}
            fmt={(v) => `${v.toFixed(2).replace('.', ',')}%`}
          />
          <p className="mt-3 text-[11px] italic" style={{ color: 'var(--color-ink-tertiary)' }}>
            ⚠ Dane GA4 sprzyjają ekosystemowi Google (Organic/Paid Search). Paid Social (Meta, Pinterest)
            i Social Organic są niedoszacowane w atrybucji.
          </p>
        </div>
      </section>
    </div>
  );
}
