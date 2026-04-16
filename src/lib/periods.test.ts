import { describe, it, expect } from 'vitest';
import { resolvePeriod, resolveCompare, PERIOD_KEYS } from './periods';

const TODAY = new Date('2026-04-16T12:00:00Z'); // fixed reference (Thursday)

describe('resolvePeriod', () => {
  it('today = today only', () => {
    expect(resolvePeriod('today', TODAY)).toEqual({
      start: '2026-04-16', end: '2026-04-16',
    });
  });

  it('yesterday = yesterday only', () => {
    expect(resolvePeriod('yesterday', TODAY)).toEqual({
      start: '2026-04-15', end: '2026-04-15',
    });
  });

  it('last_7d = 7 days ending yesterday', () => {
    expect(resolvePeriod('last_7d', TODAY)).toEqual({
      start: '2026-04-09', end: '2026-04-15',
    });
  });

  it('last_30d = 30 days ending yesterday', () => {
    expect(resolvePeriod('last_30d', TODAY)).toEqual({
      start: '2026-03-17', end: '2026-04-15',
    });
  });

  it('last_90d = 90 days ending yesterday', () => {
    expect(resolvePeriod('last_90d', TODAY)).toEqual({
      start: '2026-01-16', end: '2026-04-15',
    });
  });

  it('this_month = 1st of current month to today', () => {
    expect(resolvePeriod('this_month', TODAY)).toEqual({
      start: '2026-04-01', end: '2026-04-16',
    });
  });

  it('last_month = full previous month', () => {
    expect(resolvePeriod('last_month', TODAY)).toEqual({
      start: '2026-03-01', end: '2026-03-31',
    });
  });

  it('this_week = Monday of this week to today (ISO)', () => {
    // 2026-04-16 is Thursday; Monday = 2026-04-13
    expect(resolvePeriod('this_week', TODAY)).toEqual({
      start: '2026-04-13', end: '2026-04-16',
    });
  });

  it('last_week = Monday to Sunday of previous week', () => {
    expect(resolvePeriod('last_week', TODAY)).toEqual({
      start: '2026-04-06', end: '2026-04-12',
    });
  });

  it('this_quarter = Q2 so Apr 1 to today', () => {
    expect(resolvePeriod('this_quarter', TODAY)).toEqual({
      start: '2026-04-01', end: '2026-04-16',
    });
  });

  it('last_quarter = full Q1 2026', () => {
    expect(resolvePeriod('last_quarter', TODAY)).toEqual({
      start: '2026-01-01', end: '2026-03-31',
    });
  });

  it('ytd = Jan 1 to today', () => {
    expect(resolvePeriod('ytd', TODAY)).toEqual({
      start: '2026-01-01', end: '2026-04-16',
    });
  });

  it('custom = passes through', () => {
    expect(resolvePeriod('custom_2026-03-01_2026-04-15', TODAY)).toEqual({
      start: '2026-03-01', end: '2026-04-15',
    });
  });

  it('custom invalid throws', () => {
    expect(() => resolvePeriod('custom_not-a-date_also-bad' as any, TODAY)).toThrow();
  });
});

describe('resolveCompare', () => {
  it('previous_period shifts window back by its length', () => {
    const period = { start: '2026-03-17', end: '2026-04-15' }; // 30 days
    expect(resolveCompare(period, 'previous_period')).toEqual({
      start: '2026-02-15', end: '2026-03-16',
    });
  });

  it('same_period_last_year shifts by 1 year', () => {
    const period = { start: '2026-03-17', end: '2026-04-15' };
    expect(resolveCompare(period, 'same_period_last_year')).toEqual({
      start: '2025-03-17', end: '2025-04-15',
    });
  });

  it('same_period_last_quarter shifts by ~90 days', () => {
    const period = { start: '2026-04-01', end: '2026-04-16' };
    expect(resolveCompare(period, 'same_period_last_quarter')).toEqual({
      start: '2026-01-01', end: '2026-01-16',
    });
  });

  it('none returns null', () => {
    const period = { start: '2026-04-01', end: '2026-04-16' };
    expect(resolveCompare(period, 'none')).toBeNull();
  });
});

describe('PERIOD_KEYS contains 13 presets', () => {
  it('lists all', () => {
    expect(PERIOD_KEYS).toEqual([
      'today', 'yesterday',
      'last_7d', 'last_30d', 'last_90d',
      'this_week', 'last_week',
      'this_month', 'last_month',
      'this_quarter', 'last_quarter',
      'this_year', 'ytd',
    ]);
  });
});
