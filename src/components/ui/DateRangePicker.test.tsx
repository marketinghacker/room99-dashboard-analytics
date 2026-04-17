import { describe, it, expect } from 'vitest';
import { rangeToPeriodKey, periodKeyToRange } from './DateRangePicker';

describe('rangeToPeriodKey', () => {
  it('formats dates as custom_YYYY-MM-DD_YYYY-MM-DD', () => {
    expect(
      rangeToPeriodKey({ from: new Date('2026-04-05T00:00:00Z'), to: new Date('2026-04-12T00:00:00Z') })
    ).toBe('custom_2026-04-05_2026-04-12');
  });
  it('works for single-day range (same from/to)', () => {
    const d = new Date('2026-04-17T00:00:00Z');
    expect(rangeToPeriodKey({ from: d, to: d })).toBe('custom_2026-04-17_2026-04-17');
  });
});

describe('periodKeyToRange', () => {
  it('parses a custom key back into Date objects', () => {
    const r = periodKeyToRange('custom_2026-04-05_2026-04-12');
    expect(r?.from.toISOString().slice(0, 10)).toBe('2026-04-05');
    expect(r?.to.toISOString().slice(0, 10)).toBe('2026-04-12');
  });
  it('returns undefined for non-custom keys', () => {
    expect(periodKeyToRange('last_7d')).toBeUndefined();
  });
  it('returns undefined for malformed custom keys', () => {
    expect(periodKeyToRange('custom_nope_also-nope')).toBeUndefined();
  });
});
