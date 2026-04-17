'use client';

/**
 * On mount: GETs /api/auth/me, stores auth role in Zustand.
 * On role change: reflects to html[data-role="..."] so CSS can gate
 * `.agency-only` elements without per-component conditionals.
 */
import { useEffect } from 'react';
import { useRole } from '@/stores/role';

export function RoleHydrator() {
  const { role, authRole, setAuthRole } = useRole();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const data = (await res.json()) as { role: 'client' | 'agency' };
        if (!cancelled) setAuthRole(data.role);
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
