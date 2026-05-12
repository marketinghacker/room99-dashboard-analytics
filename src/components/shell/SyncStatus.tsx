'use client';

/**
 * Per-tab last-sync indicator. Shows a traffic-light dot + relative-time label
 * for the OLDEST relevant source — i.e. "the staleness you should be worried
 * about right now".
 *
 *   <SyncStatus sources={['meta','google_ads']} />
 *
 * Visual rules:
 *   - <2h fresh  → green dot, "Aktualne"
 *   - 2–24h      → amber dot, "Sync N godz. temu"
 *   - >24h OR any failed source → red dot, "Sync N godz. temu" / "Błąd sync"
 *
 * The Allegro warning is shown in the tooltip whenever `sources` includes a
 * BaseLinker-backed source (sellrocket/products) — orders confirm 12-48h
 * after purchase, so even a fresh sync can show under-reported recent days.
 */
import useSWR from 'swr';
import { dependsOnAllegro, SOURCE_LABEL } from '@/lib/tab-source-mapping';

type HeartbeatRow = {
  source: string;
  status: string;
  finishedAt: string;
};

type Heartbeat = {
  bySource: HeartbeatRow[];
  lastRun: HeartbeatRow | null;
};

type Tone = 'fresh' | 'warning' | 'stale' | 'unknown';

export type SyncBadgeState = {
  tone: Tone;
  label: string;
  ageMs: number | null;
  oldest: HeartbeatRow | null;
  /** Per-source rows, in original `sources` order, for tooltip rendering. */
  rows: Array<{ source: string; row: HeartbeatRow | null; ageMs: number | null }>;
  hasFailure: boolean;
};

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pure logic — given a heartbeat payload + the sources we care about + a
 * "now" timestamp, return everything the UI needs to render. Split out so
 * tests can hit it without DOM/SWR.
 */
export function computeBadge(
  heartbeat: Heartbeat | undefined,
  sources: readonly string[],
  now: number,
): SyncBadgeState {
  if (!heartbeat || sources.length === 0) {
    return {
      tone: 'unknown',
      label: 'sync · —',
      ageMs: null,
      oldest: null,
      rows: sources.map((s) => ({ source: s, row: null, ageMs: null })),
      hasFailure: false,
    };
  }

  const bySourceMap = new Map<string, HeartbeatRow>();
  for (const r of heartbeat.bySource) {
    bySourceMap.set(r.source, r);
  }

  let oldest: HeartbeatRow | null = null;
  let oldestAge = -1;
  let hasFailure = false;

  const rows = sources.map((s) => {
    const row = bySourceMap.get(s) ?? null;
    if (!row) return { source: s, row: null, ageMs: null };
    const age = now - new Date(row.finishedAt).getTime();
    if (row.status !== 'success') hasFailure = true;
    if (age > oldestAge) {
      oldestAge = age;
      oldest = row;
    }
    return { source: s, row, ageMs: age };
  });

  // Some requested sources have NO finished run yet — treat that as stale
  // (data has never been synced). Surface as red/unknown so the user notices.
  const missing = rows.some((r) => r.row === null);
  if (missing && !oldest) {
    return {
      tone: 'stale',
      label: 'sync · —',
      ageMs: null,
      oldest: null,
      rows,
      hasFailure,
    };
  }

  let tone: Tone;
  if (hasFailure || oldestAge > ONE_DAY_MS) tone = 'stale';
  else if (oldestAge > TWO_HOURS_MS) tone = 'warning';
  else tone = 'fresh';

  let label: string;
  if (hasFailure) {
    label = 'Błąd sync';
  } else if (oldestAge < TWO_HOURS_MS && !missing) {
    label = 'Aktualne';
  } else {
    label = `Sync ${formatAge(oldestAge)}`;
  }

  return { tone, label, ageMs: oldestAge, oldest, rows, hasFailure };
}

/**
 * Polish-locale relative-time formatter. NOT lazy ("temu" suffix included).
 *  <60s → "X s temu"
 *  <60min → "X min temu"
 *  <24h → "X godz. temu"
 *  >=24h → "X dni temu"
 */
export function formatAge(ms: number): string {
  const secs = Math.max(0, Math.floor(ms / 1000));
  if (secs < 60) return `${secs} s temu`;
  if (secs < 3600) return `${Math.floor(secs / 60)} min temu`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} godz. temu`;
  return `${Math.floor(secs / 86400)} dni temu`;
}

const TONE_TO_CSS_VAR: Record<Tone, string> = {
  fresh: 'var(--color-accent-positive)',
  warning: 'var(--color-accent-warning)',
  stale: 'var(--color-accent-negative)',
  unknown: 'var(--color-ink-tertiary)',
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type SyncStatusProps = {
  /** Sources relevant to the current tab (from TAB_SOURCES). */
  sources: readonly string[];
  /** Override "now" for tests. */
  now?: number;
  /** Override the heartbeat payload for tests; otherwise SWR-fetched. */
  heartbeatOverride?: Heartbeat;
};

export function SyncStatus({ sources, now, heartbeatOverride }: SyncStatusProps) {
  // Fetch every minute — matches the cron cadence (~25 min), so we'll
  // typically catch a fresh run within a minute of it landing.
  const { data } = useSWR<Heartbeat>(
    heartbeatOverride ? null : '/api/data/sync-heartbeat',
    fetcher,
    { refreshInterval: 60_000 },
  );
  const heartbeat = heartbeatOverride ?? data;
  const badge = computeBadge(heartbeat, sources, now ?? Date.now());

  const tooltip = buildTooltip(badge, sources, now ?? Date.now());

  return (
    <div
      role="status"
      aria-label={tooltip}
      title={tooltip}
      data-tone={badge.tone}
      className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-[0.06em] tabular-nums"
      style={{ color: 'var(--color-ink-tertiary)' }}
    >
      <span
        aria-hidden
        data-testid="sync-status-dot"
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: TONE_TO_CSS_VAR[badge.tone] }}
      />
      <span data-testid="sync-status-label">{badge.label}</span>
    </div>
  );
}

/**
 * Builds a multi-line text tooltip listing every requested source's age +
 * status, plus the Allegro warning when relevant. Multi-line via \n — works
 * in native title attribute and in screen readers via aria-label.
 */
function buildTooltip(badge: SyncBadgeState, sources: readonly string[], now: number): string {
  const lines: string[] = [];
  for (const r of badge.rows) {
    const label = SOURCE_LABEL[r.source as keyof typeof SOURCE_LABEL] ?? r.source;
    if (!r.row) {
      lines.push(`${label}: brak danych`);
      continue;
    }
    const age = formatAge(now - new Date(r.row.finishedAt).getTime());
    const status = r.row.status === 'success' ? 'ok' : `${r.row.status}`;
    lines.push(`${label}: ${age} (${status})`);
  }
  if (dependsOnAllegro(sources)) {
    lines.push('');
    lines.push(
      'Allegro: dane mogą być niekompletne dla ostatnich 24h (orderzy potwierdzają się 12-48h od zakupu).',
    );
  }
  return lines.join('\n');
}
