// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SyncStatus, computeBadge, formatAge } from './SyncStatus';

const FIXED_NOW = new Date('2026-05-08T12:00:00Z').getTime();

function rowAt(source: string, minutesAgo: number, status: 'success' | 'failed' = 'success') {
  return {
    source,
    status,
    finishedAt: new Date(FIXED_NOW - minutesAgo * 60_000).toISOString(),
  };
}

function heartbeat(rows: ReturnType<typeof rowAt>[]) {
  return { bySource: rows, lastRun: rows[0] ?? null };
}

describe('formatAge', () => {
  it('seconds', () => {
    expect(formatAge(5_000)).toBe('5 s temu');
  });
  it('minutes', () => {
    expect(formatAge(5 * 60_000)).toBe('5 min temu');
  });
  it('hours', () => {
    expect(formatAge(3 * 3_600_000)).toBe('3 godz. temu');
  });
  it('days', () => {
    expect(formatAge(2 * 86_400_000)).toBe('2 dni temu');
  });
});

describe('computeBadge', () => {
  it('fresh tone when oldest source is <2h old', () => {
    const hb = heartbeat([rowAt('meta', 30), rowAt('google_ads', 90)]);
    const b = computeBadge(hb, ['meta', 'google_ads'], FIXED_NOW);
    expect(b.tone).toBe('fresh');
    expect(b.label).toBe('Aktualne');
    expect(b.hasFailure).toBe(false);
  });

  it('warning tone at 2-24h', () => {
    const hb = heartbeat([rowAt('meta', 30), rowAt('google_ads', 4 * 60)]); // 4h ago
    const b = computeBadge(hb, ['meta', 'google_ads'], FIXED_NOW);
    expect(b.tone).toBe('warning');
    expect(b.label).toMatch(/Sync.*godz/);
  });

  it('exact 2h boundary stays fresh', () => {
    const hb = heartbeat([rowAt('meta', 119)]); // just under 2h
    const b = computeBadge(hb, ['meta'], FIXED_NOW);
    expect(b.tone).toBe('fresh');
  });

  it('just over 2h flips to warning', () => {
    const hb = heartbeat([rowAt('meta', 121)]); // just over 2h
    const b = computeBadge(hb, ['meta'], FIXED_NOW);
    expect(b.tone).toBe('warning');
  });

  it('stale tone when >24h', () => {
    const hb = heartbeat([rowAt('meta', 25 * 60)]); // 25h ago
    const b = computeBadge(hb, ['meta'], FIXED_NOW);
    expect(b.tone).toBe('stale');
  });

  it('failed source forces stale even when recent', () => {
    const hb = heartbeat([rowAt('meta', 5, 'failed')]); // failed 5min ago
    const b = computeBadge(hb, ['meta'], FIXED_NOW);
    expect(b.tone).toBe('stale');
    expect(b.label).toBe('Błąd sync');
    expect(b.hasFailure).toBe(true);
  });

  it('OLDEST source wins (most stale across multi-source set)', () => {
    const hb = heartbeat([rowAt('meta', 1), rowAt('google_ads', 5 * 60)]);
    const b = computeBadge(hb, ['meta', 'google_ads'], FIXED_NOW);
    expect(b.tone).toBe('warning');
    expect(b.oldest?.source).toBe('google_ads');
  });

  it('returns unknown when no heartbeat data yet', () => {
    const b = computeBadge(undefined, ['meta'], FIXED_NOW);
    expect(b.tone).toBe('unknown');
    expect(b.label).toBe('sync · —');
  });

  it('returns stale when source has never been synced', () => {
    const hb = heartbeat([rowAt('meta', 5)]); // products has no row
    const b = computeBadge(hb, ['products'], FIXED_NOW);
    expect(b.tone).toBe('stale');
  });

  it('mixed: failed in one source flips tone to stale', () => {
    const hb = heartbeat([rowAt('meta', 5), rowAt('google_ads', 5, 'failed')]);
    const b = computeBadge(hb, ['meta', 'google_ads'], FIXED_NOW);
    expect(b.tone).toBe('stale');
    expect(b.hasFailure).toBe(true);
  });
});

describe('SyncStatus component', () => {
  it('renders the badge label and dot', () => {
    const hb = heartbeat([rowAt('meta', 5)]);
    const { getByTestId } = render(
      <SyncStatus sources={['meta']} now={FIXED_NOW} heartbeatOverride={hb} />,
    );
    expect(getByTestId('sync-status-label').textContent).toBe('Aktualne');
    const dot = getByTestId('sync-status-dot');
    expect(dot.getAttribute('style')).toContain('var(--color-accent-positive)');
  });

  it('amber dot for warning tone', () => {
    const hb = heartbeat([rowAt('meta', 4 * 60)]);
    const { getByTestId } = render(
      <SyncStatus sources={['meta']} now={FIXED_NOW} heartbeatOverride={hb} />,
    );
    expect(getByTestId('sync-status-dot').getAttribute('style')).toContain(
      'var(--color-accent-warning)',
    );
  });

  it('terracotta dot for stale tone (failed source)', () => {
    const hb = heartbeat([rowAt('meta', 5, 'failed')]);
    const { getByTestId } = render(
      <SyncStatus sources={['meta']} now={FIXED_NOW} heartbeatOverride={hb} />,
    );
    expect(getByTestId('sync-status-dot').getAttribute('style')).toContain(
      'var(--color-accent-negative)',
    );
  });

  it('tooltip includes Allegro warning when sellrocket in sources', () => {
    const hb = heartbeat([rowAt('sellrocket', 5)]);
    const { container } = render(
      <SyncStatus sources={['sellrocket']} now={FIXED_NOW} heartbeatOverride={hb} />,
    );
    const status = container.querySelector('[role="status"]')!;
    expect(status.getAttribute('title')).toMatch(/Allegro/);
    expect(status.getAttribute('title')).toMatch(/12-48h/);
  });

  it('tooltip omits Allegro warning for ad-platform-only sources', () => {
    const hb = heartbeat([rowAt('meta', 5)]);
    const { container } = render(
      <SyncStatus sources={['meta']} now={FIXED_NOW} heartbeatOverride={hb} />,
    );
    expect(container.querySelector('[role="status"]')!.getAttribute('title')).not.toMatch(/Allegro/);
  });

  it('tooltip lists per-source ages in Polish', () => {
    const hb = heartbeat([rowAt('meta', 5), rowAt('google_ads', 30)]);
    const { container } = render(
      <SyncStatus sources={['meta', 'google_ads']} now={FIXED_NOW} heartbeatOverride={hb} />,
    );
    const title = container.querySelector('[role="status"]')!.getAttribute('title')!;
    expect(title).toMatch(/Meta Ads.*5 min temu/);
    expect(title).toMatch(/Google Ads.*30 min temu/);
  });
});
