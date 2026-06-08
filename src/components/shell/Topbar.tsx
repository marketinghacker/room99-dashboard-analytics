'use client';

/**
 * Editorial topbar — sits next to the sidebar.
 *  [date picker] [refresh] [export]
 */
import { useState } from 'react';
import { mutate } from 'swr';
import { useTab, type TabId } from '@/stores/tab';
import { useFilters } from '@/stores/filters';
import { FilterBar } from './FilterBar';
import { RefreshCw, Download } from 'lucide-react';
import Papa from 'papaparse';

const TAB_ENDPOINT: Record<TabId, string> = {
  'executive-summary':     '/api/data/executive-summary',
  funnel:                  '/api/data/funnel',
  'top-products':          '/api/data/top-products',
  'performance-marketing': '/api/data/performance-marketing',
  'traffic-sources':       '/api/data/traffic-sources',
  'sales-channels':        '/api/data/sales-channels',
  'sales-tree':            '/api/data/sales-tree',
  'product-catalogs':      '/api/data/product-catalogs',
  'meta-ads':              '/api/data/meta-ads',
  'google-ads':            '/api/data/google-ads',
  pinterest:               '/api/data/pinterest',
  criteo:                  '/api/data/criteo',
};

/**
 * Walks a JSON response and returns the biggest array we can find —
 * typically `items`, `timeSeries`, or `campaigns`. That's the most useful
 * rows for a CSV export. Falls back to the top-level object as a single row.
 */
function pickTableRows(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  const candidates = ['items', 'timeSeries', 'campaigns', 'rows', 'records'];
  for (const k of candidates) {
    const v = obj[k];
    if (Array.isArray(v) && v.length) return v as Array<Record<string, unknown>>;
  }
  // Nested payload (our /api/data/meta-ads etc. wrap inside payload)
  if (obj.payload && typeof obj.payload === 'object') {
    return pickTableRows(obj.payload);
  }
  return [obj];
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const csv = Papa.unparse(rows, { delimiter: ',' });
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function Topbar() {
  const tab = useTab((s) => s.tab);
  const { period, compare } = useFilters();
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  /**
   * "Odśwież" = full refresh: trigger sync-now on the server, then revalidate
   * SWR caches. Client users don't have sync-now access (agency-only), so for
   * them this is just a SWR revalidate. Agency users get fresh Meta/Google/
   * BaseLinker data pulled before the SWR invalidate.
   */
  async function onRefresh() {
    setRefreshing(true);
    try {
      // Agency users: trigger fresh backend sync. 403 for clients — that's fine.
      const res = await fetch('/api/sync-now', { method: 'POST' });
      if (res.ok) {
        // Give the sync ~10s to write first rows, then revalidate.
        await new Promise((r) => setTimeout(r, 10_000));
      }
    } catch {
      /* fall through to SWR revalidate */
    } finally {
      await mutate(() => true, undefined, { revalidate: true });
      setRefreshing(false);
    }
  }

  async function onExport() {
    setExporting(true);
    try {
      const url = `${TAB_ENDPOINT[tab]}?period=${period}&compare=${compare}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`export: ${res.status}`);
      const data = await res.json();
      const rows = pickTableRows(data);
      if (rows.length === 0) throw new Error('Brak danych do eksportu');
      const ts = new Date().toISOString().slice(0, 10);
      downloadCsv(`room99_${tab}_${period}_${ts}.csv`, rows);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <header
      className="sticky top-0 z-30"
      style={{
        borderBottom: '1px solid var(--color-line-soft)',
        // Solid bg — translucent backdrop-blur was letting content bleed through.
        background: 'var(--color-bg-base)',
      }}
    >
      {/* No overflow here — it would clip absolutely-positioned popovers
          (date picker, select dropdowns) that sit below the pill. min-w-0 on
          the breadcrumb lets it truncate on narrow screens instead. */}
      <div className="flex items-center gap-4 px-8 h-14 whitespace-nowrap">
        {/* Breadcrumb „§0X · NAZWA ● Aktualne" usunięty (06.2026) — tytuł sekcji
            jest w nagłówku strony, a status sync-u w stopce sidebara. */}
        <div className="ml-auto flex items-center gap-3 shrink-0">
          {/* Przełącznik Agency/Client usunięty (06.2026). */}
          <FilterBar />

          <div className="h-5 w-px shrink-0" style={{ background: 'var(--color-line-soft)' }} />

          <button
            type="button"
            onClick={onRefresh}
            title="Odśwież widok (pobiera cache z serwera)"
            className="h-8 px-2.5 rounded-[6px] flex items-center gap-1.5 text-[12px] shrink-0"
            style={{ color: 'var(--color-ink-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <RefreshCw className={refreshing ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />
            Odśwież
          </button>
          {/* „Sync" i „Odśwież dane" usunięte (06.2026) — „Odśwież" i tak
              pobiera świeże dane z backendu, a potem odświeża widok. */}

          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            title="Pobierz CSV z aktualnymi danymi tej zakładki"
            className="h-8 px-2.5 rounded-[6px] flex items-center gap-1.5 text-[12px] shrink-0 disabled:opacity-50"
            style={{ color: 'var(--color-ink-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Download className={exporting ? 'w-3.5 h-3.5 animate-pulse' : 'w-3.5 h-3.5'} />
            {exporting ? 'Eksport…' : 'Eksport'}
          </button>
        </div>
      </div>

    </header>
  );
}
