'use client';

import useSWR from 'swr';
import { useFilters } from '@/stores/filters';

/**
 * Shorthand: fetches `${base}?period=...&compare=...` using current filter state.
 */
export function useFilteredSWR<T = any>(base: string | null) {
  const { period, compare } = useFilters();
  const key = base ? `${base}?period=${period}&compare=${compare}` : null;
  return useSWR<T>(key);
}
