'use client';

/**
 * Tabele produktowe z draftu (Widok 3): TOP 25 wg sprzedaży, TOP 5 wzrost MoM,
 * BOTTOM 5 spadek MoM. Sprzedaż: Shoper (po ID). Ruch: GA4 per produkt
 * (wyświetlenia + WoW) — „czy spadek to ruch, czy konwersja".
 * Filtry: kategoria + kolekcja + rozmiar (mental model klienta).
 */
import { useState } from 'react';
import useSWR from 'swr';
import { useFilters } from '@/stores/filters';
import { SectionHead, Sparkline } from '@/components/primitives/editorial';
import { DeltaBadge } from '@/components/primitives/DeltaBadge';
import { LoadingCard, ErrorCard } from '@/components/primitives/StateCard';
import { formatPLN, formatInt, formatPct } from '@/lib/format';

type Row = {
  sku: string;
  name: string;
  category: string | null;
  collection: string | null;
  size: string | null;
  thumbnail: string | null;
  qty: number;
  revenue: number;
  share: number | null;
  wowChange: number | null;
  momChange: number | null;
  viewsWeekly: number;
  viewsWowChange: number | null;
  trend30?: number[];
};

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--color-ink-secondary)' }}>
      <span className="overline" style={{ fontSize: 9 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 px-2 rounded-[6px] text-[12px] border outline-none"
        style={{
          background: 'var(--color-bg-card)',
          borderColor: 'var(--color-line-soft)',
          color: 'var(--color-ink-primary)',
        }}
      >
        <option value="">Wszystkie</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function ProductCell({ r }: { r: Row }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {r.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={r.thumbnail}
          alt=""
          loading="lazy"
          className="w-9 h-9 rounded-[6px] object-cover shrink-0"
          style={{ border: '1px solid var(--color-line-soft)', background: 'var(--color-bg-elevated)' }}
        />
      ) : (
        <div
          className="w-9 h-9 rounded-[6px] shrink-0"
          style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-line-soft)' }}
        />
      )}
      <div className="min-w-0">
        <div className="font-medium truncate max-w-[320px] text-[13px]" title={r.name}>{r.name}</div>
        <div className="text-[11px]" style={{ color: 'var(--color-ink-tertiary)' }}>
          {[r.category, r.collection, r.size].filter(Boolean).join(' · ') || '—'}
        </div>
      </div>
    </div>
  );
}

function MomTable({ rows, emptyNote }: { rows: Row[]; emptyNote: string }) {
  if (!rows.length) {
    return (
      <div className="card p-4 text-[12px]" style={{ color: 'var(--color-ink-tertiary)' }}>
        {emptyNote}
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-line-soft)' }}>
            <th className="table-header text-left px-4 py-3">Produkt</th>
            <th className="table-header text-right px-4 py-3">Sprzedaż (szt.)</th>
            <th className="table-header text-right px-4 py-3">Przychód</th>
            <th className="table-header text-right px-4 py-3">% udział</th>
            <th className="table-header text-right px-4 py-3">Zmiana MoM</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sku} style={{ borderBottom: '1px solid var(--color-line-soft)' }}>
              <td className="px-4 py-2.5"><ProductCell r={r} /></td>
              <td className="px-4 py-2.5 text-right numeric table-cell">{formatInt(r.qty)}</td>
              <td className="px-4 py-2.5 text-right numeric table-cell">{formatPLN(r.revenue)}</td>
              <td className="px-4 py-2.5 text-right numeric table-cell">{r.share != null ? formatPct(r.share) : '—'}</td>
              <td className="px-4 py-2.5 text-right"><DeltaBadge pct={r.momChange} size="xs" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TopProductsDraft() {
  const { period } = useFilters();
  const [category, setCategory] = useState('');
  const [collection, setCollection] = useState('');
  const [size, setSize] = useState('');

  const params = new URLSearchParams({ period });
  if (category) params.set('category', category);
  if (collection) params.set('collection', collection);
  if (size) params.set('size', size);
  const { data, error, isLoading } = useSWR<any>(`/api/data/top-products-list?${params.toString()}`);

  if (isLoading) return <LoadingCard minHeight={300} />;
  if (error) return <ErrorCard error={String((error as Error).message ?? error)} />;
  if (!data) return null;

  const top25: Row[] = data.top25 ?? [];
  const top5: Row[] = data.top5Growth ?? [];
  const bottom5: Row[] = data.bottom5Decline ?? [];

  return (
    <div className="flex flex-col gap-10">
      {/* §02 TOP 25 — filtry kategoria/kolekcja/rozmiar */}
      <section>
        <SectionHead
          number="§02"
          title="TOP 25 produktów (według sprzedaży)"
          sub="Sprzedaż i przychód: Shoper (po ID produktu). Ruch: GA4 — wyświetlenia ostatnich 7 dni + zmiana WoW."
          right={
            <div className="flex items-center gap-3">
              <FilterSelect label="Kategoria" value={category} options={data.filters?.categories ?? []} onChange={(v) => { setCategory(v); setCollection(''); setSize(''); }} />
              <FilterSelect label="Kolekcja" value={collection} options={data.filters?.collections ?? []} onChange={setCollection} />
              <FilterSelect label="Rozmiar" value={size} options={data.filters?.sizes ?? []} onChange={setSize} />
            </div>
          }
        />
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-line-soft)' }}>
                <th className="table-header text-left px-4 py-3">Produkt</th>
                <th className="table-header text-right px-4 py-3">Sprzedaż (szt.)</th>
                <th className="table-header text-right px-4 py-3">Przychód</th>
                <th className="table-header text-right px-4 py-3">% udział</th>
                <th className="table-header text-right px-4 py-3">Zmiana WoW</th>
                <th className="table-header text-right px-4 py-3" title="GA4: wyświetlenia produktu, ostatnie 7 dni">Ruch (7d)</th>
                <th className="table-header text-right px-4 py-3" title="Zmiana wyświetleń WoW">Zmiana ruchu</th>
                <th className="table-header text-left px-4 py-3">Trend (30 dni)</th>
              </tr>
            </thead>
            <tbody>
              {top25.map((r) => (
                <tr
                  key={r.sku}
                  style={{ borderBottom: '1px solid var(--color-line-soft)' }}
                  className="transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-4 py-2.5"><ProductCell r={r} /></td>
                  <td className="px-4 py-2.5 text-right numeric table-cell">{formatInt(r.qty)}</td>
                  <td className="px-4 py-2.5 text-right numeric table-cell">{formatPLN(r.revenue)}</td>
                  <td className="px-4 py-2.5 text-right numeric table-cell">{r.share != null ? formatPct(r.share) : '—'}</td>
                  <td className="px-4 py-2.5 text-right"><DeltaBadge pct={r.wowChange} size="xs" /></td>
                  <td className="px-4 py-2.5 text-right numeric table-cell">
                    {r.viewsWeekly > 0 ? formatInt(r.viewsWeekly) : <span style={{ color: 'var(--color-ink-tertiary)' }}>—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right"><DeltaBadge pct={r.viewsWowChange} size="xs" /></td>
                  <td className="px-4 py-2.5">
                    {r.trend30 && r.trend30.some((v) => v > 0) ? (
                      <Sparkline data={r.trend30} width={88} height={20} color="var(--color-accent-2)" />
                    ) : (
                      <span className="text-[11px]" style={{ color: 'var(--color-ink-tertiary)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.ga4Joined && (
            <p className="px-4 py-2.5 text-[11px] italic" style={{ color: 'var(--color-ink-tertiary)', borderTop: '1px solid var(--color-line-soft)' }}>
              ℹ Kolumny ruchu czekają na dane GA4 per produkt (sync ga4_products) — pojawią się po pierwszym pełnym cronie.
            </p>
          )}
        </div>
      </section>

      {/* §03 TOP 5 wzrost MoM */}
      <section>
        <SectionHead
          number="§03"
          title="TOP 5 produktów — największy wzrost vs ostatni miesiąc"
          sub={`Okno stałe: ${data.windows?.last30?.start} → ${data.windows?.last30?.end} vs poprzednie 30 dni. Minimum 1 000 zł bazy przychodu.`}
        />
        <MomTable rows={top5} emptyNote="Za mało danych MoM (sync products musi objąć ≥60 dni)." />
      </section>

      {/* §04 BOTTOM 5 spadek MoM */}
      <section>
        <SectionHead
          number="§04"
          title="BOTTOM 5 produktów — największy spadek vs ostatni miesiąc"
          sub={'Kandydaci do diagnozy: porównaj „Zmiana MoM” z „Zmiana ruchu” — spadek ruchu = problem widoczności, ruch stabilny = problem konwersji/sezonu.'}
        />
        <MomTable rows={bottom5} emptyNote="Za mało danych MoM (sync products musi objąć ≥60 dni)." />
      </section>
    </div>
  );
}
