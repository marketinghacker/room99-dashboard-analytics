'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  type DateRange,
  type PresetId,
  type ComparisonMode,
  getPresetRange,
  getComparisonRange,
  formatDateRangeLabel,
} from '@/lib/date-utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DateRangeState {
  /** Current date range */
  range: DateRange;
  /** Comparison date range */
  comparison: DateRange;
  /** Active preset (null if custom) */
  preset: PresetId | null;
  /** Comparison mode */
  comparisonMode: ComparisonMode;
  /** Human-readable label for the current range */
  rangeLabel: string;
  /** Human-readable label for the comparison */
  comparisonLabel: string;
  /** Timestamp of last data refresh */
  lastRefresh: number;

  /** Set a preset date range */
  setPreset: (preset: PresetId) => void;
  /** Set a custom date range */
  setCustomRange: (start: string, end: string) => void;
  /** Set the comparison mode */
  setComparisonMode: (mode: ComparisonMode) => void;
  /** Trigger a refresh (increments lastRefresh timestamp) */
  triggerRefresh: () => void;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const DateRangeContext = createContext<DateRangeState | null>(null);

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

interface DateRangeProviderProps {
  children: ReactNode;
  defaultPreset?: PresetId;
}

export function DateRangeProvider({
  children,
  defaultPreset = 'this_month',
}: DateRangeProviderProps) {
  const [preset, setPresetState] = useState<PresetId | null>(defaultPreset);
  const [range, setRange] = useState<DateRange>(() => getPresetRange(defaultPreset));
  const [comparisonMode, setComparisonModeState] = useState<ComparisonMode>('previous_period');
  const [lastRefresh, setLastRefresh] = useState<number>(() => Date.now());

  // Sync URL search params on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlStart = params.get('start');
    const urlEnd = params.get('end');
    const urlPreset = params.get('preset') as PresetId | null;
    const urlComparison = params.get('comparison') as ComparisonMode | null;

    if (urlPreset) {
      setPresetState(urlPreset);
      setRange(getPresetRange(urlPreset));
    } else if (urlStart && urlEnd) {
      setPresetState(null);
      setRange({ start: urlStart, end: urlEnd });
    }

    if (urlComparison) {
      setComparisonModeState(urlComparison);
    }
  }, []);

  // Update URL when range changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (preset) {
      params.set('preset', preset);
    } else {
      params.set('start', range.start);
      params.set('end', range.end);
    }
    params.set('comparison', comparisonMode);

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [range, preset, comparisonMode]);

  const comparison = getComparisonRange(range, comparisonMode);

  const setPreset = useCallback((p: PresetId) => {
    setPresetState(p);
    setRange(getPresetRange(p));
  }, []);

  const setCustomRange = useCallback((start: string, end: string) => {
    setPresetState(null);
    setRange({ start, end });
  }, []);

  const setComparisonMode = useCallback((mode: ComparisonMode) => {
    setComparisonModeState(mode);
  }, []);

  const triggerRefresh = useCallback(() => {
    setLastRefresh(Date.now());
  }, []);

  const rangeLabel = formatDateRangeLabel(range);
  const comparisonLabel = comparisonMode === 'year_over_year'
    ? `vs ${formatDateRangeLabel(comparison)} (YoY)`
    : `vs ${formatDateRangeLabel(comparison)}`;

  return (
    <DateRangeContext.Provider
      value={{
        range,
        comparison,
        preset,
        comparisonMode,
        rangeLabel,
        comparisonLabel,
        lastRefresh,
        setPreset,
        setCustomRange,
        setComparisonMode,
        triggerRefresh,
      }}
    >
      {children}
    </DateRangeContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useDateRange(): DateRangeState {
  const ctx = useContext(DateRangeContext);
  if (!ctx) {
    throw new Error('useDateRange must be used within a DateRangeProvider');
  }
  return ctx;
}
