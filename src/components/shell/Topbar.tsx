'use client';

/**
 * Editorial topbar — sits next to the sidebar.
 *  [breadcrumb]               [role switch] [date picker] [refresh] [export]
 *
 * Role switch is a segmented control — only visible to agency users.
 * Preview toggle (agency viewing the client view) lives here.
 */
import { useState } from 'react';
import { mutate } from 'swr';
import { useTab, type TabId } from '@/stores/tab';
import { useFilters } from '@/stores/filters';
import { useRole } from '@/stores/role';
import { FilterBar } from './FilterBar';
import { RefreshCw, Download, RotateCw } from 'lucide-react';
import Papa from 'papaparse';

const TAB_ENDPOINT: Record<TabId, string> = {
  'executive-summary':     '/api/data/executive-summary',
  funnel:                  '/api/data/funnel',
  'top-products':          '/api/data/top-products',
  'performance-marketing': '/api/data/performance-marketing',
  'traffic-sources':       '/api/data/traffic-sources',
  'sales-channels':        '/api/data/sales-channels',
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

const TAB_LABELS: Record<string, string> = {
  'executive-summary':     '§01 · Podsumowanie',
  funnel:                  '§02 · Lejek',
  'top-products':          '§03 · Produkty',
  'performance-marketing': '§04 · Performance',
  'traffic-sources':       '§05 · Ruch',
  'sales-channels':        '§06 · Sprzedaż',
  'product-catalogs':      '§07 · Katalogi',
  'meta-ads':              '§08 · Meta Ads',
  'google-ads':            '§09 · Google Ads',
  pinterest:               '§10 · Pinterest',
  criteo:                  '§11 · Criteo',
};

function RoleSegmented() {
  const { authRole, isPreviewingClient, setPreviewClient } = useRole();
  if (authRole !== 'agency') return null;

  return (
    <div
      role="tablist"
      className="inline-flex items-center p-[3px] rounded-[8px] border text-[11px] font-medium"
      style={{
        background: 'var(--color-bg-side)',
        borderColor: 'var(--color-line-soft)',
      }}
    >
      {(['agency', 'client'] as const).map((r) => {
        const active = r === (isPreviewingClient ? 'client' : 'agency');
        const label = r === 'agency' ? 'Agency' : 'Client';
        const dot = r === 'agency' ? 'var(--color-accent)' : 'var(--color-accent-positive)';
        return (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setPreviewClient(r === 'client')}
            className="px-2.5 py-1 rounded-[6px] flex items-center gap-1.5 transition-colors"
            style={{
              background: active ? 'var(--color-bg-card)' : 'transparent',
              color: active ? 'var(--color-ink-primary)' : 'var(--color-ink-secondary)',
              boxShadow: active ? 'var(--shadow-card)' : 'none',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Topbar() {
  const tab = useTab((s) => s.tab);
  const { period, compare } = useFilters();
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  async function onRefresh() {
    setRefreshing(true);
    await mutate(() => true, undefined, { revalidate: true });
    setTimeout(() => setRefreshing(false), 600);
  }

  async function onSync() {
    setSyncing(true);
    setSyncNotice(null);
    try {
      const res = await fetch('/api/sync-now', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'sync failed');
      setSyncNotice('Sync uruchomiony (2–3 min)');
      setTimeout(() => setSyncNotice(null), 5000);
    } catch (e) {
      setSyncNotice((e as Error).message);
    } finally {
      setSyncing(false);
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
        <div
          className="text-[12px] font-mono tracking-[0.08em] uppercase min-w-0 overflow-hidden text-ellipsis"
          style={{ color: 'var(--color-ink-tertiary)' }}
        >
          {TAB_LABELS[tab] ?? tab}
        </div>

        <div className="ml-auto flex items-center gap-3 shrink-0">
          <RoleSegmented />

          <div className="h-5 w-px shrink-0" style={{ background: 'var(--color-line-soft)' }} />

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

          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            title="Zsynchronizuj na nowo (pobiera świeże dane z Meta/Google/Allegro)"
            className="agency-only h-8 px-2.5 rounded-[6px] flex items-center gap-1.5 text-[12px] shrink-0 disabled:opacity-50"
            style={{ color: 'var(--color-ink-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <RotateCw className={syncing ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />
            Sync
          </button>
          {syncNotice && (
            <span
              className="text-[11px] font-mono tracking-[0.06em] uppercase shrink-0"
              style={{ color: 'var(--color-accent)' }}
            >
              {syncNotice}
            </span>
          )}

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
