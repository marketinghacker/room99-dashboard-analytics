'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDateRange } from '@/contexts/DateRangeContext';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DashboardDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  refresh: () => void;
}

interface FetchOptions {
  /** Extra query params beyond start/end dates */
  extraParams?: Record<string, string>;
  /** Skip comparison range in the request */
  skipComparison?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

/**
 * Generic hook for fetching dashboard data from API routes.
 * Automatically passes date range from context and handles loading/error states.
 *
 * @param endpoint - API route path, e.g. '/api/data/google-ads'
 * @param options - Additional options
 */
export function useDashboardData<T>(
  endpoint: string,
  options: FetchOptions = {}
): DashboardDataResult<T> {
  const { range, comparison, lastRefresh } = useDateRange();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(
    async (isRefresh: boolean = false) => {
      // Abort any pending request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          start: range.start,
          end: range.end,
          ...(options.skipComparison
            ? {}
            : {
                comp_start: comparison.start,
                comp_end: comparison.end,
              }),
          ...(isRefresh ? { refresh: 'true' } : {}),
          ...options.extraParams,
        });

        const response = await fetch(`${endpoint}?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          throw new Error(
            errorBody?.error || `Błąd ${response.status}: ${response.statusText}`
          );
        }

        const json = await response.json();
        setData(json.data || json);
        setLastUpdated(json.lastUpdated || new Date().toISOString());
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return; // Silently ignore aborted requests
        }
        setError(
          err instanceof Error
            ? err.message
            : 'Wystąpił nieoczekiwany błąd'
        );
      } finally {
        setLoading(false);
      }
    },
    [endpoint, range.start, range.end, comparison.start, comparison.end, options.skipComparison, options.extraParams]
  );

  // Fetch on mount and when date range changes
  useEffect(() => {
    fetchData(false);
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [fetchData]);

  // Re-fetch on manual refresh (lastRefresh changes)
  const prevRefresh = useRef(lastRefresh);
  useEffect(() => {
    if (lastRefresh !== prevRefresh.current) {
      prevRefresh.current = lastRefresh;
      fetchData(true);
    }
  }, [lastRefresh, fetchData]);

  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  return { data, loading, error, lastUpdated, refresh };
}
