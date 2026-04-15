import {
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  subQuarters,
  startOfQuarter,
  endOfQuarter,
  format,
  getUnixTime,
  startOfDay,
  endOfDay,
  differenceInDays,
  parse,
} from 'date-fns';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export interface DateRangeWithComparison extends DateRange {
  comparisonStart: string;
  comparisonEnd: string;
}

export type PresetId =
  | 'this_month'
  | 'last_month'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'this_quarter'
  | 'last_quarter';

export interface Preset {
  id: PresetId;
  label: string;
}

/* ------------------------------------------------------------------ */
/*  Presets                                                             */
/* ------------------------------------------------------------------ */

export const DATE_PRESETS: Preset[] = [
  { id: 'this_month', label: 'Ten miesiąc' },
  { id: 'last_month', label: 'Ostatni miesiąc' },
  { id: 'last_7_days', label: 'Ostatnie 7 dni' },
  { id: 'last_30_days', label: 'Ostatnie 30 dni' },
  { id: 'last_90_days', label: 'Ostatnie 90 dni' },
  { id: 'this_quarter', label: 'Ten kwartał' },
  { id: 'last_quarter', label: 'Ostatni kwartał' },
];

export type ComparisonMode = 'previous_period' | 'year_over_year';

export const COMPARISON_MODES: { id: ComparisonMode; label: string }[] = [
  { id: 'previous_period', label: 'vs Poprzedni okres' },
  { id: 'year_over_year', label: 'vs Rok temu (YoY)' },
];

/* ------------------------------------------------------------------ */
/*  Preset → date range                                                */
/* ------------------------------------------------------------------ */

export function getPresetRange(presetId: PresetId, now: Date = new Date()): DateRange {
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

  switch (presetId) {
    case 'this_month':
      return { start: fmt(startOfMonth(now)), end: fmt(now) };

    case 'last_month': {
      const prev = subMonths(now, 1);
      return { start: fmt(startOfMonth(prev)), end: fmt(endOfMonth(prev)) };
    }

    case 'last_7_days':
      return { start: fmt(subDays(now, 7)), end: fmt(subDays(now, 1)) };

    case 'last_30_days':
      return { start: fmt(subDays(now, 30)), end: fmt(subDays(now, 1)) };

    case 'last_90_days':
      return { start: fmt(subDays(now, 90)), end: fmt(subDays(now, 1)) };

    case 'this_quarter':
      return { start: fmt(startOfQuarter(now)), end: fmt(now) };

    case 'last_quarter': {
      const prevQ = subQuarters(now, 1);
      return { start: fmt(startOfQuarter(prevQ)), end: fmt(endOfQuarter(prevQ)) };
    }

    default:
      return { start: fmt(startOfMonth(now)), end: fmt(now) };
  }
}

/* ------------------------------------------------------------------ */
/*  Comparison range                                                    */
/* ------------------------------------------------------------------ */

/**
 * Given a date range and comparison mode, return the comparison period.
 * - previous_period: same number of days, immediately before
 * - year_over_year: same dates, one year earlier
 */
export function getComparisonRange(
  range: DateRange,
  mode: ComparisonMode
): DateRange {
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  const startDate = parse(range.start, 'yyyy-MM-dd', new Date());
  const endDate = parse(range.end, 'yyyy-MM-dd', new Date());
  const days = differenceInDays(endDate, startDate);

  if (mode === 'year_over_year') {
    const compStart = subMonths(startDate, 12);
    const compEnd = subMonths(endDate, 12);
    return { start: fmt(compStart), end: fmt(compEnd) };
  }

  // previous_period: shift back by (days + 1)
  const compEnd = subDays(startDate, 1);
  const compStart = subDays(compEnd, days);
  return { start: fmt(compStart), end: fmt(compEnd) };
}

/* ------------------------------------------------------------------ */
/*  Format helpers                                                      */
/* ------------------------------------------------------------------ */

/** Convert YYYY-MM-DD to unix timestamp (start of day UTC) */
export function toUnixTimestamp(dateStr: string): number {
  const date = parse(dateStr, 'yyyy-MM-dd', new Date());
  return getUnixTime(startOfDay(date));
}

/** Convert YYYY-MM-DD to unix timestamp (end of day UTC) */
export function toUnixTimestampEnd(dateStr: string): number {
  const date = parse(dateStr, 'yyyy-MM-dd', new Date());
  return getUnixTime(endOfDay(date));
}

/** Format a date range for display: "1 mar 2026 – 31 mar 2026" */
export function formatDateRangeLabel(range: DateRange): string {
  const start = parse(range.start, 'yyyy-MM-dd', new Date());
  const end = parse(range.end, 'yyyy-MM-dd', new Date());
  return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`;
}

/**
 * Map a custom date range to the closest Google Ads date_range preset.
 * Falls back to 'LAST_30_DAYS' if no match.
 */
export function toGoogleAdsDateRange(range: DateRange): string {
  const now = new Date();
  const start = parse(range.start, 'yyyy-MM-dd', new Date());
  const end = parse(range.end, 'yyyy-MM-dd', new Date());

  // Check if it's "this month"
  if (
    format(start, 'yyyy-MM-dd') === format(startOfMonth(now), 'yyyy-MM-dd')
  ) {
    return 'THIS_MONTH';
  }

  // Check if it's "last month"
  const lastMonth = subMonths(now, 1);
  if (
    format(start, 'yyyy-MM-dd') === format(startOfMonth(lastMonth), 'yyyy-MM-dd') &&
    format(end, 'yyyy-MM-dd') === format(endOfMonth(lastMonth), 'yyyy-MM-dd')
  ) {
    return 'LAST_MONTH';
  }

  const days = differenceInDays(end, start);
  if (days <= 7) return 'LAST_7_DAYS';
  if (days <= 30) return 'LAST_30_DAYS';
  if (days <= 90) return 'LAST_90_DAYS';
  return 'LAST_30_DAYS';
}

/**
 * Map a custom date range to the closest Meta Ads date_preset.
 */
export function toMetaDatePreset(range: DateRange): string {
  const now = new Date();
  const start = parse(range.start, 'yyyy-MM-dd', new Date());
  const end = parse(range.end, 'yyyy-MM-dd', new Date());

  if (format(start, 'yyyy-MM-dd') === format(startOfMonth(now), 'yyyy-MM-dd')) {
    return 'this_month';
  }

  const lastMonth = subMonths(now, 1);
  if (
    format(start, 'yyyy-MM-dd') === format(startOfMonth(lastMonth), 'yyyy-MM-dd') &&
    format(end, 'yyyy-MM-dd') === format(endOfMonth(lastMonth), 'yyyy-MM-dd')
  ) {
    return 'last_month';
  }

  const days = differenceInDays(end, start);
  if (days <= 3) return 'last_3d';
  if (days <= 7) return 'last_7d';
  if (days <= 14) return 'last_14d';
  if (days <= 28) return 'last_28d';
  if (days <= 30) return 'last_30d';
  return 'last_90d';
}
