import { describe, it, expect } from 'vitest';
import { buildAdsDailyRows, type Campaign } from './pinterest';

describe('buildAdsDailyRows (pinterest)', () => {
  it('maps a single row with all metrics, divides micros by 1M', () => {
    const campaigns = new Map<string, Campaign>([
      ['626755196414', {
        id: '626755196414',
        name: 'Performance+ - Konwersje - Zasłony tarasowe',
        status: 'ACTIVE',
        objective_type: 'WEB_CONVERSION',
      }],
    ]);
    const rows = buildAdsDailyRows(
      [
        {
          DATE: '2026-05-05',
          CAMPAIGN_ID: '626755196414',
          SPEND_IN_MICRO_DOLLAR: 754_643_355,        // 754.64 PLN
          IMPRESSION_1: 12_062,
          CLICKTHROUGH_1: 356,
          CTR: 0.0295,                                // ignored — recomputed
          CPC_IN_MICRO_DOLLAR: 2_119_217,
          CPM_IN_MICRO_DOLLAR: 62_563_510,
          TOTAL_CHECKOUT: 12,
          TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR: 97_600_000, // 97.60 PLN
        },
      ],
      campaigns,
    );

    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.date).toBe('2026-05-05');
    expect(r.platform).toBe('pinterest');
    expect(r.campaignId).toBe('626755196414');
    expect(r.campaignName).toBe('Performance+ - Konwersje - Zasłony tarasowe');
    expect(r.campaignStatus).toBe('ACTIVE');
    expect(r.campaignObjective).toBe('WEB_CONVERSION');
    expect(Number(r.spend)).toBeCloseTo(754.6434, 4);
    expect(r.impressions).toBe(12_062);
    expect(r.clicks).toBe(356);
    // conversions = TOTAL_CHECKOUT (real purchases), not TOTAL_CONVERSIONS
    // (which is noisier all-events sum incl. page_visit/add_to_cart).
    expect(Number(r.conversions)).toBe(12);
    expect(Number(r.conversionValue)).toBeCloseTo(97.6, 4);
  });

  it('recomputes ctr/cpc/cpm from aggregated totals (ignores Pinterest pre-computed values)', () => {
    const rows = buildAdsDailyRows(
      [
        {
          DATE: '2026-05-05',
          CAMPAIGN_ID: 'c1',
          SPEND_IN_MICRO_DOLLAR: 100_000_000, // 100 PLN
          IMPRESSION_1: 10_000,
          CLICKTHROUGH_1: 100,
          CTR: 0.999, // bogus — ignored
        },
      ],
      new Map(),
    );
    const r = rows[0];
    expect(Number(r.ctr)).toBeCloseTo(0.01, 6);   // 100 / 10000
    expect(Number(r.cpc)).toBeCloseTo(1, 6);      // 100 / 100
    expect(Number(r.cpm)).toBeCloseTo(10, 6);     // 100 / 10000 * 1000
  });

  it('aggregates duplicate (date, campaign_id) rows into one row', () => {
    const rows = buildAdsDailyRows(
      [
        {
          DATE: '2026-05-05',
          CAMPAIGN_ID: 'c1',
          SPEND_IN_MICRO_DOLLAR: 100_000_000, // 100 PLN
          IMPRESSION_1: 5_000,
          CLICKTHROUGH_1: 50,
          TOTAL_CHECKOUT: 6,
          TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR: 50_000_000, // 50 PLN
        },
        {
          DATE: '2026-05-05',
          CAMPAIGN_ID: 'c1',
          SPEND_IN_MICRO_DOLLAR: 200_000_000, // 200 PLN
          IMPRESSION_1: 5_000,
          CLICKTHROUGH_1: 50,
          TOTAL_CHECKOUT: 3,
          TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR: 30_000_000, // 30 PLN
        },
      ],
      new Map(),
    );
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(Number(r.spend)).toBeCloseTo(300, 4);
    expect(r.impressions).toBe(10_000);
    expect(r.clicks).toBe(100);
    expect(Number(r.conversions)).toBe(9);
    expect(Number(r.conversionValue)).toBeCloseTo(80, 4);
  });

  it('falls back to campaignId for name when listing has no metadata', () => {
    const rows = buildAdsDailyRows(
      [
        {
          DATE: '2026-05-05',
          CAMPAIGN_ID: 'c1',
          SPEND_IN_MICRO_DOLLAR: 1_000_000,
          IMPRESSION_1: 100,
          CLICKTHROUGH_1: 1,
        },
      ],
      new Map(),
    );
    const r = rows[0];
    expect(r.campaignName).toBe('c1');
    expect(r.campaignStatus).toBeNull();
    expect(r.campaignObjective).toBeNull();
  });

  it('uses listed campaign metadata when present', () => {
    const campaigns = new Map<string, Campaign>([
      ['c1', { id: 'c1', name: 'From listing', status: 'PAUSED', objective_type: 'WEB_CONVERSION' }],
    ]);
    const rows = buildAdsDailyRows(
      [
        {
          DATE: '2026-05-05',
          CAMPAIGN_ID: 'c1',
          SPEND_IN_MICRO_DOLLAR: 1_000_000,
          IMPRESSION_1: 100,
          CLICKTHROUGH_1: 1,
        },
      ],
      campaigns,
    );
    const r = rows[0];
    expect(r.campaignName).toBe('From listing');
    expect(r.campaignStatus).toBe('PAUSED');
    expect(r.campaignObjective).toBe('WEB_CONVERSION');
  });

  it('skips rows without DATE or CAMPAIGN_ID', () => {
    const rows = buildAdsDailyRows(
      [
        { DATE: '', CAMPAIGN_ID: 'c1', SPEND_IN_MICRO_DOLLAR: 1 },
        { DATE: '2026-05-05', CAMPAIGN_ID: undefined as unknown as string, SPEND_IN_MICRO_DOLLAR: 1 },
        { DATE: '2026-05-05', CAMPAIGN_ID: 'c1', SPEND_IN_MICRO_DOLLAR: 1_000_000, IMPRESSION_1: 1, CLICKTHROUGH_1: 1 },
      ],
      new Map(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].campaignId).toBe('c1');
  });

  it('handles missing money columns as 0', () => {
    const rows = buildAdsDailyRows(
      [{ DATE: '2026-05-05', CAMPAIGN_ID: 'c1' }],
      new Map(),
    );
    const r = rows[0];
    expect(Number(r.spend)).toBe(0);
    expect(r.impressions).toBe(0);
    expect(r.clicks).toBe(0);
    expect(Number(r.conversions)).toBe(0);
    expect(Number(r.conversionValue)).toBe(0);
    expect(r.ctr).toBeNull();
    expect(r.cpc).toBeNull();
    expect(r.cpm).toBeNull();
  });

  it('coerces numeric CAMPAIGN_ID to string for stable upsert key', () => {
    const rows = buildAdsDailyRows(
      [
        {
          DATE: '2026-05-05',
          CAMPAIGN_ID: 626755196414 as unknown as number,
          SPEND_IN_MICRO_DOLLAR: 1_000_000,
          IMPRESSION_1: 1,
          CLICKTHROUGH_1: 1,
        },
      ],
      new Map(),
    );
    expect(rows[0].campaignId).toBe('626755196414');
    expect(typeof rows[0].campaignId).toBe('string');
  });
});
