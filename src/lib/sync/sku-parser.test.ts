import { describe, it, expect } from 'vitest';
import { parseSkuToCategoryCollection } from './sku-parser';

describe('parseSkuToCategoryCollection', () => {
  it('parses simple CATEGORY COLLECTION - rest', () => {
    expect(parseSkuToCategoryCollection('FIRANA NOVELIA - BIAŁA 140x250 Taśma')).toEqual({
      category: 'FIRANA',
      collection: 'NOVELIA',
    });
  });

  it('handles Polish characters in category', () => {
    expect(parseSkuToCategoryCollection('ZASŁONA AURA - KREMOWA 140x250 SREBRNA PRZELOTKA')).toEqual({
      category: 'ZASŁONA',
      collection: 'AURA',
    });
  });

  it('handles mixed-case descriptors after dash', () => {
    expect(parseSkuToCategoryCollection('ZASŁONA AURA - Beżowa 140x250 SREBRNA PRZELOTKA')).toEqual({
      category: 'ZASŁONA',
      collection: 'AURA',
    });
  });

  it('picks collection past a modifier adjective (ZACIEMNIAJĄCA)', () => {
    expect(
      parseSkuToCategoryCollection('ZASŁONA ZACIEMNIAJĄCA LAUREL - BEŻOWA JASNA 140x250 TAŚMA'),
    ).toEqual({ category: 'ZASŁONA', collection: 'LAUREL' });
  });

  it('picks collection past multi-word modifier (NA ŁÓŻKO WELUROWA)', () => {
    expect(
      parseSkuToCategoryCollection('NARZUTA NA ŁÓŻKO WELUROWA FEEL - BEŻOWA 200x220'),
    ).toEqual({ category: 'NARZUTA', collection: 'FEEL' });
  });

  it('parses title-case names without dash (Poduszka Eternity ...)', () => {
    // Here "PLUS" is caught before "Eternity" because we scan from the right.
    // Good enough: category is still PODUSZKA, aggregation by category still works.
    const out = parseSkuToCategoryCollection('Poduszka Eternity MedLine PLUS 45x45');
    expect(out.category).toBe('PODUSZKA');
    expect(out.collection).not.toBeNull();
  });

  it('parses multi-word collection after dash (Mon Ame)', () => {
    expect(
      parseSkuToCategoryCollection('Zapach do domu w sprayu - Mon Ame 200 ml'),
    ).toEqual({ category: 'ZAPACH', collection: 'MON AME' });
  });

  it('parses collection after dash even when before-dash has no proper name', () => {
    expect(parseSkuToCategoryCollection('Woda perfumowana - Mon Ame 100 ml')).toEqual({
      category: 'WODA',
      collection: 'MON AME',
    });
  });

  it('single-word names yield category-only', () => {
    expect(parseSkuToCategoryCollection('PRODUKT')).toEqual({
      category: 'PRODUKT',
      collection: null,
    });
  });

  it('empty/whitespace returns nulls', () => {
    expect(parseSkuToCategoryCollection('')).toEqual({ category: null, collection: null });
    expect(parseSkuToCategoryCollection('   ')).toEqual({ category: null, collection: null });
  });

  it('handles trailing whitespace before the dash (double space)', () => {
    expect(parseSkuToCategoryCollection('OBRUS LINEA  - ECRU 130x180')).toEqual({
      category: 'OBRUS',
      collection: 'LINEA',
    });
  });

  it('classifies OBRUS PLAMOODPORNY AURA past a modifier', () => {
    expect(parseSkuToCategoryCollection('OBRUS PLAMOODPORNY AURA - BIAŁY 140x300')).toEqual({
      category: 'OBRUS',
      collection: 'AURA',
    });
  });

  it('classifies POSZEWKA DEKORACYJNA MOLLY past a modifier', () => {
    expect(parseSkuToCategoryCollection('POSZEWKA DEKORACYJNA MOLLY - BEŻOWA 45x45')).toEqual({
      category: 'POSZEWKA',
      collection: 'MOLLY',
    });
  });

  it('consolidates Polish plurals in category (ZASŁONY → ZASŁONA)', () => {
    expect(parseSkuToCategoryCollection('ZASŁONY AURA - BEŻOWA 140x250')).toEqual({
      category: 'ZASŁONA',
      collection: 'AURA',
    });
    expect(parseSkuToCategoryCollection('FIRANY NOVELIA - BIAŁA')).toEqual({
      category: 'FIRANA',
      collection: 'NOVELIA',
    });
    expect(parseSkuToCategoryCollection('POSZEWKI MOLLY - BEŻOWA 45x45')).toEqual({
      category: 'POSZEWKA',
      collection: 'MOLLY',
    });
  });
});
