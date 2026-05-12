/**
 * Pinned-down tests for the Marketing Hackers retainer math.
 * `agencyFeeForDate` and `totalAgencyFee` drive the COS displayed on the
 * Executive Summary; if these slip, every "ile budżet vs przychód" number
 * on the dashboard goes wrong.
 */
import { describe, it, expect } from 'vitest';
import { AGENCY_MONTHLY_FEE_PLN, agencyFeeForDate, totalAgencyFee } from './rollup';

describe('AGENCY_MONTHLY_FEE_PLN', () => {
  it('is 25 000 zł', () => {
    expect(AGENCY_MONTHLY_FEE_PLN).toBe(25_000);
  });
});

describe('agencyFeeForDate', () => {
  it('uses 31 for May (31-day month)', () => {
    expect(agencyFeeForDate('2026-05-07')).toBeCloseTo(25_000 / 31, 6);
  });

  it('uses 30 for April (30-day month)', () => {
    expect(agencyFeeForDate('2026-04-15')).toBeCloseTo(25_000 / 30, 6);
  });

  it('uses 28 for February in a non-leap year', () => {
    expect(agencyFeeForDate('2026-02-10')).toBeCloseTo(25_000 / 28, 6);
  });

  it('uses 29 for February in a leap year (2024)', () => {
    expect(agencyFeeForDate('2024-02-29')).toBeCloseTo(25_000 / 29, 6);
  });

  it('day-of-month does not matter — every day in the same month gets the same fee', () => {
    const first = agencyFeeForDate('2026-05-01');
    const last = agencyFeeForDate('2026-05-31');
    expect(first).toBe(last);
  });
});

describe('totalAgencyFee', () => {
  it('full single month sums to exactly the monthly fee', () => {
    expect(totalAgencyFee({ start: '2026-05-01', end: '2026-05-31' })).toBeCloseTo(25_000, 6);
    expect(totalAgencyFee({ start: '2026-04-01', end: '2026-04-30' })).toBeCloseTo(25_000, 6);
    expect(totalAgencyFee({ start: '2026-02-01', end: '2026-02-28' })).toBeCloseTo(25_000, 6);
  });

  it('single day = MONTHLY / days-in-that-month', () => {
    expect(totalAgencyFee({ start: '2026-05-07', end: '2026-05-07' })).toBeCloseTo(25_000 / 31, 6);
  });

  it('range spanning two months sums each month proportionally', () => {
    // Apr 25–30 (6 days @ 25000/30) + May 1–7 (7 days @ 25000/31)
    const expected = (25_000 / 30) * 6 + (25_000 / 31) * 7;
    expect(totalAgencyFee({ start: '2026-04-25', end: '2026-05-07' })).toBeCloseTo(expected, 6);
  });

  it('YTD (2026-01-01 → 2026-05-08) = 4 full months + 8 days of May', () => {
    // Jan + Feb + Mar + Apr = 4 × 25000 = 100_000. May 1–8 = 8 × (25000/31).
    const expected = 4 * 25_000 + 8 * (25_000 / 31);
    expect(totalAgencyFee({ start: '2026-01-01', end: '2026-05-08' })).toBeCloseTo(expected, 6);
  });

  it('inclusive on both ends', () => {
    // start === end, single day: should be one day's fee, not zero or two.
    expect(totalAgencyFee({ start: '2026-05-15', end: '2026-05-15' })).toBeCloseTo(25_000 / 31, 6);
  });
});
