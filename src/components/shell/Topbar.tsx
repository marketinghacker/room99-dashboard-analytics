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
import { useTab } from '@/stores/tab';
import { useRole } from '@/stores/role';
import { FilterBar } from './FilterBar';
import { RefreshCw, Download, RotateCw } from 'lucide-react';

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
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
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

  return (
    <header
      className="sticky top-0 z-30"
      style={{
        borderBottom: '1px solid var(--color-line-soft)',
        // Solid bg — translucent backdrop-blur was letting content bleed through.
        background: 'var(--color-bg-base)',
      }}
    >
      <div className="flex items-center gap-4 px-8 h-14 whitespace-nowrap overflow-x-auto">
        <div
          className="text-[12px] font-mono tracking-[0.08em] uppercase shrink-0"
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
            title="Eksport CSV (wkrótce)"
            className="h-8 px-2.5 rounded-[6px] flex items-center gap-1.5 text-[12px] shrink-0"
            style={{ color: 'var(--color-ink-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Download className="w-3.5 h-3.5" />
            Eksport
          </button>
        </div>
      </div>
    </header>
  );
}
