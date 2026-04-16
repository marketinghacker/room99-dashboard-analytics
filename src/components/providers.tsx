'use client';

import { SWRConfig } from 'swr';
import { ReactNode, useEffect } from 'react';
import { useFilters } from '@/stores/filters';
import { useTab, type TabId } from '@/stores/tab';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? res.statusText), { status: res.status, body });
  }
  return res.json();
};

/**
 * URL-hash sync: reads `#tab=meta-ads&period=last_7d&compare=none` on mount,
 * writes back when filters change. Lets you bookmark a specific dashboard view.
 */
function useUrlHashSync() {
  const setBoth = useFilters((s) => s.setBoth);
  const setTab = useTab((s) => s.setTab);
  const { period, compare } = useFilters();
  const { tab } = useTab();

  // Read hash once on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const h = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(h);
    const p = params.get('period');
    const c = params.get('compare');
    const t = params.get('tab') as TabId | null;
    if (p || c) setBoth((p as any) ?? 'last_30d', (c as any) ?? 'previous_period');
    if (t) setTab(t);
  }, [setBoth, setTab]);

  // Write hash when state changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = `tab=${tab}&period=${period}&compare=${compare}`;
    if (window.location.hash.replace(/^#/, '') !== hash) {
      history.replaceState(null, '', `#${hash}`);
    }
  }, [period, compare, tab]);
}

function HashSync({ children }: { children: ReactNode }) {
  useUrlHashSync();
  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: true,
        dedupingInterval: 30_000,
        errorRetryCount: 2,
        errorRetryInterval: 1500,
      }}
    >
      <HashSync>{children}</HashSync>
    </SWRConfig>
  );
}
