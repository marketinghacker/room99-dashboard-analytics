'use client';

/**
 * Editorial sidebar — 260px fixed. Brand + nav + sync status + user footer.
 * Numbered sections (§01–§10) mirror the magazine feel; active state = thin
 * left rule + darker ink.
 */
import { useTab, type TabId } from '@/stores/tab';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { cn } from '@/components/ui/cn';
import {
  LayoutDashboard,
  Activity,
  Store,
  Sparkles,
  ShoppingBag,
  LineChart,
  Package,
  PieChart,
  Target,
  Circle,
  LogOut,
} from 'lucide-react';

type NavItem = {
  id: TabId;
  label: string;
  number: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  group: 'overview' | 'marketing' | 'channels' | 'platforms';
};

const NAV: NavItem[] = [
  { id: 'executive-summary',     label: 'Podsumowanie', number: '§01', icon: LayoutDashboard, group: 'overview' },
  { id: 'top-products',          label: 'Produkty',     number: '§02', icon: Package,         group: 'overview' },
  { id: 'performance-marketing', label: 'Performance',  number: '§03', icon: Activity,        group: 'marketing' },
  { id: 'traffic-sources',       label: 'Ruch',         number: '§04', icon: LineChart,       group: 'marketing' },
  { id: 'sales-channels',        label: 'Sprzedaż',     number: '§05', icon: Store,           group: 'channels' },
  { id: 'product-catalogs',      label: 'Katalogi',     number: '§06', icon: ShoppingBag,     group: 'channels' },
  { id: 'meta-ads',              label: 'Meta Ads',     number: '§07', icon: Circle,          group: 'platforms' },
  { id: 'google-ads',            label: 'Google Ads',   number: '§08', icon: Circle,          group: 'platforms' },
  { id: 'pinterest',             label: 'Pinterest',    number: '§09', icon: Circle,          group: 'platforms' },
  { id: 'criteo',                label: 'Criteo',       number: '§10', icon: Circle,          group: 'platforms' },
];

const GROUP_LABELS: Record<NavItem['group'], string> = {
  overview:   'Przegląd',
  marketing:  'Marketing',
  channels:   'Sprzedaż',
  platforms:  'Platformy',
};

type Me = { role: 'client' | 'agency'; email: string; displayName?: string };

function SyncStatus() {
  const { data } = useSWR<{ lastRun?: { finishedAt: string | null; status: string } }>(
    '/api/data/sync-heartbeat',
    { refreshInterval: 60_000 },
  );
  const ago = data?.lastRun?.finishedAt
    ? relativeAgo(new Date(data.lastRun.finishedAt))
    : null;

  return (
    <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-ink-tertiary)' }}>
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          data?.lastRun?.status === 'success' ? 'bg-[var(--color-accent-positive)]' : 'bg-[var(--color-accent-warning)]',
        )}
      />
      <span className="font-mono tracking-[0.06em]">
        {ago ? `sync · ${ago}` : 'sync · —'}
      </span>
    </div>
  );
}

function relativeAgo(d: Date): string {
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s temu`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m temu`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h temu`;
  return `${Math.floor(secs / 86400)}d temu`;
}

export function Sidebar() {
  const { tab, setTab } = useTab();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe(d))
      .catch(() => {});
  }, []);

  const grouped = (['overview', 'marketing', 'channels', 'platforms'] as const).map((g) => ({
    group: g,
    items: NAV.filter((n) => n.group === g),
  }));

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <aside
      className="fixed top-0 left-0 bottom-0 w-[260px] z-20 flex flex-col"
      style={{
        background: 'var(--color-bg-side)',
        borderRight: '1px solid var(--color-line-soft)',
      }}
    >
      {/* Brand */}
      <div className="px-6 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-[8px] flex items-center justify-center"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-bg-card)',
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              fontSize: '14px',
            }}
          >
            R99
          </div>
          <div className="flex flex-col leading-tight">
            <span className="overline" style={{ fontSize: '9px' }}>
              № 03 · dashboard
            </span>
            <span
              className="text-[14px]"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: 'var(--color-ink-primary)',
              }}
            >
              Room99
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 pb-4">
        {grouped.map(({ group, items }) => (
          <div key={group} className="mb-5">
            <div
              className="px-3 mb-1.5 font-mono"
              style={{
                fontSize: '9px',
                letterSpacing: '0.16em',
                color: 'var(--color-ink-tertiary)',
                textTransform: 'uppercase',
                fontWeight: 500,
              }}
            >
              {GROUP_LABELS[group]}
            </div>
            <div className="flex flex-col">
              {items.map((n) => {
                const active = n.id === tab;
                return (
                  <button
                    key={n.id}
                    onClick={() => setTab(n.id)}
                    className={cn(
                      'relative flex items-center gap-2.5 px-3 py-1.5 rounded-[6px] text-left transition-colors',
                      active ? 'font-medium' : 'font-normal',
                    )}
                    style={{
                      color: active
                        ? 'var(--color-ink-primary)'
                        : 'var(--color-ink-secondary)',
                      background: active ? 'var(--color-bg-card)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = 'var(--color-bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full"
                        style={{ background: 'var(--color-accent)' }}
                      />
                    )}
                    <span
                      className="font-mono w-[22px] shrink-0 text-[10px]"
                      style={{
                        color: active
                          ? 'var(--color-accent)'
                          : 'var(--color-ink-tertiary)',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {n.number}
                    </span>
                    <span className="text-[13px] flex-1 truncate">{n.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sync + user */}
      <div
        className="px-4 py-3 border-t"
        style={{ borderColor: 'var(--color-line-soft)' }}
      >
        <div className="mb-2"><SyncStatus /></div>
        {me && (
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium"
              style={{
                background: me.role === 'agency' ? 'var(--color-accent)' : 'var(--color-accent-positive)',
                color: 'white',
              }}
            >
              {(me.displayName ?? me.email)[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] truncate" style={{ color: 'var(--color-ink-primary)' }}>
                {me.displayName ?? me.email}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-[0.08em]" style={{ color: 'var(--color-ink-tertiary)' }}>
                {me.role}
              </div>
            </div>
            <button
              onClick={logout}
              title="Wyloguj"
              className="p-1.5 rounded-[6px]"
              style={{ color: 'var(--color-ink-tertiary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.4} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
