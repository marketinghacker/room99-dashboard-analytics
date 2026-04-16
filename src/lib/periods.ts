/**
 * Period resolution for dashboard filters.
 * All dates are UTC to avoid timezone drift on server/client.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export const PERIOD_KEYS = [
  'today', 'yesterday',
  'last_7d', 'last_30d', 'last_90d',
  'this_week', 'last_week',
  'this_month', 'last_month',
  'this_quarter', 'last_quarter',
  'this_year', 'ytd',
] as const;

export type PresetPeriodKey = typeof PERIOD_KEYS[number];
export type PeriodKey = PresetPeriodKey | `custom_${string}_${string}`;

export type CompareKey = 'previous_period' | 'same_period_last_year' | 'same_period_last_quarter' | 'none';

export type DateRange = { start: string; end: string };

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return utcDate(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function startOfMonth(d: Date): Date {
  return utcDate(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function endOfQuarter(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3);
  return utcDate(d.getUTCFullYear(), q * 3 + 3, 0);
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3);
  return utcDate(d.getUTCFullYear(), q * 3, 1);
}

function startOfISOWeek(d: Date): Date {
  // Monday = 1, Sunday = 0 → normalize Sunday to 7
  const day = d.getUTCDay() || 7;
  return addDays(d, -(day - 1));
}

export function resolvePeriod(key: PeriodKey, now: Date = new Date()): DateRange {
  const today = utcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const yesterday = addDays(today, -1);

  switch (key) {
    case 'today': return { start: fmt(today), end: fmt(today) };
    case 'yesterday': return { start: fmt(yesterday), end: fmt(yesterday) };
    case 'last_7d': return { start: fmt(addDays(yesterday, -6)), end: fmt(yesterday) };
    case 'last_30d': return { start: fmt(addDays(yesterday, -29)), end: fmt(yesterday) };
    case 'last_90d': return { start: fmt(addDays(yesterday, -89)), end: fmt(yesterday) };
    case 'this_week': return { start: fmt(startOfISOWeek(today)), end: fmt(today) };
    case 'last_week': {
      const thisMonday = startOfISOWeek(today);
      const lastMonday = addDays(thisMonday, -7);
      const lastSunday = addDays(thisMonday, -1);
      return { start: fmt(lastMonday), end: fmt(lastSunday) };
    }
    case 'this_month': return { start: fmt(startOfMonth(today)), end: fmt(today) };
    case 'last_month': {
      const firstOfThis = startOfMonth(today);
      const lastOfPrev = addDays(firstOfThis, -1);
      return { start: fmt(startOfMonth(lastOfPrev)), end: fmt(lastOfPrev) };
    }
    case 'this_quarter': return { start: fmt(startOfQuarter(today)), end: fmt(today) };
    case 'last_quarter': {
      const firstOfThisQ = startOfQuarter(today);
      const lastOfPrevQ = addDays(firstOfThisQ, -1);
      return { start: fmt(startOfQuarter(lastOfPrevQ)), end: fmt(endOfQuarter(lastOfPrevQ)) };
    }
    case 'this_year':
    case 'ytd':
      return { start: fmt(utcDate(today.getUTCFullYear(), 0, 1)), end: fmt(today) };
    default: {
      const m = /^custom_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(key);
      if (!m) throw new Error(`Invalid period key: ${key}`);
      return { start: m[1], end: m[2] };
    }
  }
}

export function resolveCompare(period: DateRange, compare: CompareKey): DateRange | null {
  if (compare === 'none') return null;
  const start = parseDate(period.start);
  const end = parseDate(period.end);
  const lengthDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;

  if (compare === 'previous_period') {
    const newEnd = addDays(start, -1);
    const newStart = addDays(newEnd, -(lengthDays - 1));
    return { start: fmt(newStart), end: fmt(newEnd) };
  }
  if (compare === 'same_period_last_year') {
    return {
      start: fmt(utcDate(start.getUTCFullYear() - 1, start.getUTCMonth(), start.getUTCDate())),
      end: fmt(utcDate(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate())),
    };
  }
  if (compare === 'same_period_last_quarter') {
    return { start: fmt(addDays(start, -90)), end: fmt(addDays(end, -90)) };
  }
  return null;
}
