/**
 * pl-PL formatters for dashboard numbers / dates / deltas.
 * Always output regular ASCII space as thousands separator (Intl yields NBSP by default).
 */
const PLACEHOLDER = '—';

const PL_MONTH_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

function nbspToSpace(s: string) {
  // Intl.NumberFormat('pl-PL') uses U+00A0 (NBSP) and U+202F (NNBSP) as thousands separators.
  return s.replace(/[\u00A0\u202F]/g, ' ');
}

export function formatInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return PLACEHOLDER;
  return nbspToSpace(new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(n));
}

/**
 * Full-precision PLN — always 2 decimals, never rounded to whole złotówki.
 * User-facing metrics (revenue, spend, ROAS, AOV, CPA) show the real
 * 62 546,95 zł not the rounded 62 547 zł — client reconciles against Meta
 * Ads Manager / Google Ads UI to the grosz.
 */
export function formatPLN(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return PLACEHOLDER;
  return nbspToSpace(
    new Intl.NumberFormat('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n),
  ) + ' zł';
}

/** Alias retained for call sites that explicitly want 2-decimal PLN. */
export const formatPLN2 = formatPLN;

/** Whole-złoty version — opt-in, use only when 2 decimals break layout. */
export function formatPLNRounded(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return PLACEHOLDER;
  return `${formatInt(Math.round(n))} zł`;
}

export function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return PLACEHOLDER;
  return nbspToSpace(
    new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n * 100)
  ) + '%';
}

export function formatCTR(n: number | null | undefined): string {
  return formatPct(n);
}

function plMonth(monthIdx: number) { return PL_MONTH_SHORT[monthIdx]; }

export function formatDateRangePL(startIso: string, endIso: string): string {
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  if (sy === ey && sm === em) {
    return `${sd} – ${ed} ${plMonth(em - 1)} ${ey}`;
  }
  if (sy === ey) {
    return `${sd} ${plMonth(sm - 1)} – ${ed} ${plMonth(em - 1)} ${ey}`;
  }
  return `${sd} ${plMonth(sm - 1)} ${sy} – ${ed} ${plMonth(em - 1)} ${ey}`;
}

export type DeltaFmt = {
  text: string;
  direction: 'up' | 'down' | 'flat';
  sign: 'positive' | 'negative' | 'neutral';
};

export function formatDelta(pct: number | null | undefined): DeltaFmt {
  if (pct == null || !Number.isFinite(pct)) return { text: PLACEHOLDER, direction: 'flat', sign: 'neutral' };
  if (pct === 0) return { text: '0,00%', direction: 'flat', sign: 'neutral' };
  const fmt = nbspToSpace(
    new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(pct * 100))
  );
  if (pct > 0) return { text: `+${fmt}%`, direction: 'up', sign: 'positive' };
  return { text: `−${fmt}%`, direction: 'down', sign: 'negative' };
}
