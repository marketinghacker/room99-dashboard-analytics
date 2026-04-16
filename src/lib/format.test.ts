import { describe, it, expect } from 'vitest';
import { formatPLN, formatInt, formatPct, formatCTR, formatDateRangePL, formatDelta } from './format';

describe('formatPLN', () => {
  it('formats thousands with space and zł suffix', () => {
    expect(formatPLN(47235)).toBe('47 235 zł');
    expect(formatPLN(1234567.89)).toBe('1 234 568 zł');
    expect(formatPLN(0)).toBe('0 zł');
  });
  it('null/undefined → placeholder', () => {
    expect(formatPLN(null)).toBe('—');
    expect(formatPLN(undefined)).toBe('—');
  });
});

describe('formatInt', () => {
  it('formats with space separators', () => {
    expect(formatInt(52836)).toBe('52 836');
    expect(formatInt(1000000)).toBe('1 000 000');
  });
});

describe('formatPct', () => {
  it('formats decimals as pct with 2 places', () => {
    expect(formatPct(0.0473)).toBe('4,73%');
    expect(formatPct(0.5)).toBe('50,00%');
    expect(formatPct(null)).toBe('—');
  });
});

describe('formatCTR', () => {
  it('formats CTR expressed as decimal', () => {
    expect(formatCTR(0.0047)).toBe('0,47%');
  });
});

describe('formatDateRangePL', () => {
  it('formats same-month range compactly', () => {
    expect(formatDateRangePL('2026-04-01', '2026-04-15')).toBe('1 – 15 kwi 2026');
  });
  it('formats cross-month range', () => {
    expect(formatDateRangePL('2026-03-17', '2026-04-15')).toBe('17 mar – 15 kwi 2026');
  });
  it('formats cross-year range', () => {
    expect(formatDateRangePL('2025-12-15', '2026-01-15')).toBe('15 gru 2025 – 15 sty 2026');
  });
});

describe('formatDelta', () => {
  it('positive with up arrow', () => {
    expect(formatDelta(0.123)).toEqual({ text: '+12,30%', direction: 'up', sign: 'positive' });
  });
  it('negative with down arrow', () => {
    expect(formatDelta(-0.051)).toEqual({ text: '−5,10%', direction: 'down', sign: 'negative' });
  });
  it('zero is neutral', () => {
    expect(formatDelta(0)).toEqual({ text: '0,00%', direction: 'flat', sign: 'neutral' });
  });
  it('null → placeholder', () => {
    expect(formatDelta(null)).toEqual({ text: '—', direction: 'flat', sign: 'neutral' });
  });
});
