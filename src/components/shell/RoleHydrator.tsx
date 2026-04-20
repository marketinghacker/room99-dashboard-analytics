'use client';

/**
 * On mount:
 *  - GETs /api/auth/me, stores auth role in Zustand.
 *  - If agency + last sync > 10 min ago → fire /api/sync-now in background
 *    so the dashboard always shows fresh-enough data without user action.
 * On role change: reflects to html[data-role="..."] so CSS can gate
 * `.agency-only` elements without per-component conditionals.
 */
import { useEffect } from 'react';
import { useRole } from '@/stores/role';

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 min

export function RoleHydrator() {
  const { role, authRole, setAuthRole } = useRole();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const data = (await res.json()) as { role: 'client' | 'agency' };
        if (cancelled) return;
        setAuthRole(data.role);

        // Agency-only auto-refresh
        if (data.role !== 'agency') return;
        const h = await fetch('/api/data/sync-heartbeat').then((r) => r.ok ? r.json() : null);
        const finishedAt = h?.lastRun?.finishedAt as string | undefined;
        const age = finishedAt ? Date.now() - new Date(finishedAt).getTime() : Infinity;
        if (age > STALE_THRESHOLD_MS) {
          // Fire and forget — SWR refetch runs on its own 30s timer.
          fetch('/api/sync-now', { method: 'POST' }).catch(() => {});
        }
      } catch {
        /* middleware will redirect on any gated request */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setAuthRole]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.role = role;
    }
  }, [role]);

  void authRole;
  return null;
}
