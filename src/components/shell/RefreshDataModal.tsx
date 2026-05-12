'use client';

/**
 * RefreshDataModal — modal launched from Topbar's "Odśwież dane" button.
 * Lets the user pick:
 *   - which sources to re-sync (defaults to TAB_SOURCES[activeTab])
 *   - the date range (defaults to currently-selected period)
 *
 * On submit POSTs /api/admin/refresh, shows progress, then mutates the SWR
 * cache so the active tab re-renders fresh data.
 *
 * Why a modal vs. inline: refresh is a low-frequency, deliberate action that
 * costs MCP/BaseLinker quota. Wrapping it in a confirmation step prevents
 * accidental clicks burning the rate-limit budget.
 */
import { useEffect, useMemo, useState } from 'react';
import { mutate as swrMutate } from 'swr';
import { ALL_SOURCES, SOURCE_LABEL, type SyncSource } from '@/lib/tab-source-mapping';
import { useFilters } from '@/stores/filters';
import { resolvePeriod } from '@/lib/periods';
import {
  DateRangePicker,
  periodKeyToRange,
  rangeToPeriodKey,
} from '@/components/ui/DateRangePicker';
import { X, Calendar, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export type RefreshDataModalProps = {
  open: boolean;
  onClose: () => void;
  /** Sources pre-checked when the modal opens. Defaults to ALL_SOURCES. */
  defaultSources?: readonly string[];
  /** SWR key(s) to revalidate after success. Pass the active tab's data
   *  endpoint(s); fallback nukes everything via mutate(() => true). */
  invalidateKeys?: readonly string[];
};

type RefreshResult = {
  ok: boolean;
  sources: Array<{
    source: string;
    status: 'success' | 'failed';
    rowsWritten?: number;
    error?: string;
    ms: number;
  }>;
  rollup: { rebuilt: boolean; ms?: number };
  totalMs: number;
};

export function RefreshDataModal({
  open,
  onClose,
  defaultSources,
  invalidateKeys,
}: RefreshDataModalProps) {
  const { period } = useFilters();

  // Internal state: which sources are checked, what range, are we submitting.
  const [selected, setSelected] = useState<Set<SyncSource>>(new Set());
  const [range, setRange] = useState<{ start: string; end: string }>(() => resolvePeriod(period));
  const [showPicker, setShowPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rebuildRollups, setRebuildRollups] = useState(true);
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // When the modal opens, hydrate selection + range from defaults. We do
  // this in an effect (not initial state) so that re-opening with different
  // defaultSources resets the form.
  useEffect(() => {
    if (!open) return;
    const initial = new Set<SyncSource>(
      (defaultSources ?? ALL_SOURCES)
        .filter((s): s is SyncSource => (ALL_SOURCES as readonly string[]).includes(s)),
    );
    // If defaultSources only contained 'all' or unknowns, fall back to all.
    if (initial.size === 0) {
      for (const s of ALL_SOURCES) initial.add(s);
    }
    setSelected(initial);
    setRange(resolvePeriod(period));
    setResult(null);
    setError(null);
  }, [open, defaultSources, period]);

  const periodKey = useMemo(
    () => rangeToPeriodKey({
      from: new Date(range.start + 'T00:00:00Z'),
      to: new Date(range.end + 'T00:00:00Z'),
    }),
    [range.start, range.end],
  );
  const initialPickerRange = useMemo(() => periodKeyToRange(periodKey), [periodKey]);

  if (!open) return null;

  function toggle(source: SyncSource) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(ALL_SOURCES));
  }

  function selectNone() {
    setSelected(new Set());
  }

  async function submit() {
    if (selected.size === 0) {
      setError('Wybierz przynajmniej jedno źródło');
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sources: Array.from(selected),
          start: range.start,
          end: range.end,
          rebuildRollups,
        }),
      });
      const body = (await res.json()) as RefreshResult & { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setResult(body);
      // Revalidate SWR caches so the dashboard re-fetches fresh data.
      if (invalidateKeys && invalidateKeys.length > 0) {
        await Promise.all(invalidateKeys.map((k) => swrMutate(k)));
      } else {
        await swrMutate(() => true, undefined, { revalidate: true });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const totalSeconds = result ? Math.round(result.totalMs / 1000) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Odśwież dane"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="rounded-[14px] w-full max-w-[540px] mx-4 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-line-soft)',
          boxShadow: 'var(--shadow-popover)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--color-line-soft)' }}
        >
          <h2
            className="text-[14px]"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              color: 'var(--color-ink-primary)',
            }}
          >
            Odśwież dane
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Zamknij"
            className="p-1.5 rounded-[6px] disabled:opacity-50"
            style={{ color: 'var(--color-ink-tertiary)' }}
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.4} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Sources */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <label
                className="text-[11px] font-mono uppercase tracking-[0.08em]"
                style={{ color: 'var(--color-ink-tertiary)' }}
              >
                Źródła
              </label>
              <div className="text-[11px] flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="underline"
                  style={{ color: 'var(--color-ink-secondary)' }}
                >
                  Wszystkie
                </button>
                <span style={{ color: 'var(--color-ink-tertiary)' }}>·</span>
                <button
                  type="button"
                  onClick={selectNone}
                  className="underline"
                  style={{ color: 'var(--color-ink-secondary)' }}
                >
                  Żadne
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_SOURCES.map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2 text-[12px] cursor-pointer p-2 rounded-[6px]"
                  style={{
                    border: '1px solid var(--color-line-soft)',
                    color: 'var(--color-ink-primary)',
                    background: selected.has(s)
                      ? 'var(--color-bg-hover)'
                      : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s)}
                    onChange={() => toggle(s)}
                    disabled={submitting}
                  />
                  <span>{SOURCE_LABEL[s]}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Date range */}
          <section>
            <label
              className="text-[11px] font-mono uppercase tracking-[0.08em] block mb-2"
              style={{ color: 'var(--color-ink-tertiary)' }}
            >
              Zakres dat
            </label>
            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              disabled={submitting}
              className="flex items-center gap-2 px-3 h-9 rounded-[6px] text-[12px] tabular-nums w-full"
              style={{
                border: '1px solid var(--color-line-soft)',
                color: 'var(--color-ink-primary)',
                background: 'var(--color-bg-card)',
              }}
            >
              <Calendar className="w-3.5 h-3.5" strokeWidth={1.4} />
              <span>{range.start} → {range.end}</span>
            </button>
            {showPicker && (
              <div className="mt-2">
                <DateRangePicker
                  initial={initialPickerRange}
                  onSelect={(key) => {
                    const r = periodKeyToRange(key);
                    if (!r?.from || !r?.to) return;
                    setRange({
                      start: r.from.toISOString().slice(0, 10),
                      end: r.to.toISOString().slice(0, 10),
                    });
                    setShowPicker(false);
                  }}
                  onClose={() => setShowPicker(false)}
                />
              </div>
            )}
          </section>

          {/* Rollup option */}
          <section>
            <label className="flex items-center gap-2 text-[12px] cursor-pointer">
              <input
                type="checkbox"
                checked={rebuildRollups}
                onChange={(e) => setRebuildRollups(e.target.checked)}
                disabled={submitting}
              />
              <span style={{ color: 'var(--color-ink-primary)' }}>
                Przebuduj cache po synchronizacji
              </span>
              <span
                className="text-[10px]"
                style={{ color: 'var(--color-ink-tertiary)' }}
              >
                (zalecane)
              </span>
            </label>
          </section>

          {/* Status */}
          {error && (
            <div
              className="p-3 rounded-[6px] text-[12px] flex items-start gap-2"
              style={{
                background: 'color-mix(in oklch, var(--color-accent-negative) 10%, transparent)',
                color: 'var(--color-accent-negative)',
              }}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.4} />
              <div>{error}</div>
            </div>
          )}

          {submitting && (
            <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--color-ink-secondary)' }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.4} />
              <span>Synchronizacja w toku — może potrwać kilka minut…</span>
            </div>
          )}

          {result && (
            <div
              className="p-3 rounded-[6px] text-[12px] space-y-1.5"
              style={{
                background: 'var(--color-bg-side)',
                border: '1px solid var(--color-line-soft)',
              }}
            >
              <div
                className="font-mono uppercase tracking-[0.08em] text-[11px] flex items-center gap-1.5"
                style={{ color: result.ok ? 'var(--color-accent-positive)' : 'var(--color-accent-warning)' }}
              >
                {result.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                <span>{result.ok ? 'Gotowe' : 'Częściowo'}</span>
                <span style={{ color: 'var(--color-ink-tertiary)' }}>
                  · {totalSeconds}s
                </span>
              </div>
              <ul className="space-y-1">
                {result.sources.map((s) => (
                  <li
                    key={s.source}
                    className="flex items-center justify-between tabular-nums"
                    style={{ color: 'var(--color-ink-secondary)' }}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background:
                            s.status === 'success'
                              ? 'var(--color-accent-positive)'
                              : 'var(--color-accent-negative)',
                        }}
                      />
                      <span>{SOURCE_LABEL[s.source as SyncSource] ?? s.source}</span>
                    </span>
                    <span style={{ color: 'var(--color-ink-tertiary)' }}>
                      {s.status === 'success'
                        ? `${s.rowsWritten ?? 0} rows · ${Math.round(s.ms / 1000)}s`
                        : (s.error ?? 'błąd')}
                    </span>
                  </li>
                ))}
              </ul>
              {result.rollup.rebuilt && (
                <div
                  className="text-[11px] pt-1.5 border-t"
                  style={{
                    borderColor: 'var(--color-line-soft)',
                    color: 'var(--color-ink-tertiary)',
                  }}
                >
                  Cache przebudowany ({Math.round((result.rollup.ms ?? 0) / 1000)}s)
                </div>
              )}
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-5 py-3 border-t"
          style={{ borderColor: 'var(--color-line-soft)' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 h-8 rounded-[6px] text-[12px] disabled:opacity-50"
            style={{ color: 'var(--color-ink-secondary)' }}
          >
            {result ? 'Zamknij' : 'Anuluj'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={submit}
              disabled={submitting || selected.size === 0}
              className="px-4 h-8 rounded-[6px] text-[12px] flex items-center gap-1.5 disabled:opacity-50"
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-bg-card)',
              }}
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.4} />}
              Odśwież
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
