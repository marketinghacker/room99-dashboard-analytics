import { describe, it, expect } from 'vitest';
import { affectedPeriods } from './rollup';

describe('affectedPeriods', () => {
  it('returns only periods containing given dates', () => {
    const today = new Date('2026-04-17T12:00:00Z');
    const result = affectedPeriods(['2026-04-15'], today);
    expect(result).toContain('last_7d');
    expect(result).toContain('this_month');
    expect(result).not.toContain('yesterday');
  });

  it('handles multiple dates', () => {
    const today = new Date('2026-04-17T12:00:00Z');
    const result = affectedPeriods(['2026-04-01', '2026-04-17'], today);
    expect(result).toContain('this_month');
    expect(result).toContain('today');
  });
});
