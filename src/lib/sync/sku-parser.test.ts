import { describe, it, expect } from 'vitest';
import { parseSkuToCategoryCollection } from './sku-parser';

describe('parseSkuToCategoryCollection', () => {
  it('parses FIRANA NOVELIA names', () => {
    expect(parseSkuToCategoryCollection('FIRANA NOVELIA - BIAŁA 140x250 Taśma')).toEqual({
      category: 'FIRANA', collection: 'NOVELIA',
    });
  });
  it('parses ZASŁONA AURA with Polish chars', () => {
    expect(parseSkuToCategoryCollection('ZASŁONA AURA - KREMOWA 140x250 SREBRNA PRZELOTKA')).toEqual({
      category: 'ZASŁONA', collection: 'AURA',
    });
  });
  it('handles names with mixed-case collection (capital first letter)', () => {
    expect(parseSkuToCategoryCollection('ZASŁONA AURA - Beżowa 140x250 SREBRNA PRZELOTKA')).toEqual({
      category: 'ZASŁONA', collection: 'AURA',
    });
  });
  it('returns null for unparseable single-word names', () => {
    expect(parseSkuToCategoryCollection('PRODUKT')).toEqual({ category: null, collection: null });
  });
  it('returns null when no dash separator', () => {
    expect(parseSkuToCategoryCollection('FIRANA NOVELIA biała 140x250')).toEqual({ category: null, collection: null });
  });
  it('handles trailing whitespace before the dash', () => {
    expect(parseSkuToCategoryCollection('OBRUS LINEA  - ECRU 130x180')).toEqual({
      category: 'OBRUS', collection: 'LINEA',
    });
  });
});
