'use client';

/**
 * Wraps a <Masthead> with an "edit" button visible only to agency users.
 * Clicking opens an inline editor for kicker / headline / lede — posts to
 * /api/editorial, then revalidates the cache so the new copy shows up.
 *
 * Defaults (passed in) come from auto-generation in the tab. Saving an empty
 * string deletes the override, reverting to the default.
 */
import { useState, type ReactNode } from 'react';
import { useRole } from '@/stores/role';
import { mutate } from 'swr';
import { Pencil, X, Check } from 'lucide-react';

type Props = {
  tab: string;
  defaultKicker: string;
  defaultHeadline: string; // "Text with *italic* inline"
  defaultLede?: string;
  children: ReactNode; // the rendered Masthead
};

export function EditableMasthead({ tab, defaultKicker, defaultHeadline, defaultLede, children }: Props) {
  const role = useRole((s) => s.role);
  const [editing, setEditing] = useState(false);
  const [kicker, setKicker] = useState(defaultKicker);
  const [headline, setHeadline] = useState(defaultHeadline);
  const [lede, setLede] = useState(defaultLede ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (role !== 'agency') return <>{children}</>;

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/editorial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab,
          updates: {
            kicker: kicker === defaultKicker ? '' : kicker,
            headline: headline === defaultHeadline ? '' : headline,
            lede: lede === (defaultLede ?? '') ? '' : lede,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'save failed');
      }
      await mutate(`/api/data/editorial-copy?tab=${tab}`);
      setEditing(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="relative group">
        {children}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity h-8 px-2.5 rounded-[6px] flex items-center gap-1.5 text-[11px]"
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-line-soft)',
            color: 'var(--color-ink-secondary)',
          }}
          title="Edytuj masthead (agency-only)"
        >
          <Pencil className="w-3 h-3" strokeWidth={1.4} />
          Edytuj
        </button>
      </div>
    );
  }

  return (
    <div className="card p-6 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="overline">Edytuj masthead · {tab}</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-8 px-3 rounded-[6px] text-[12px] flex items-center gap-1.5"
            style={{ color: 'var(--color-ink-secondary)' }}
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.4} />
            Anuluj
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-8 px-3 rounded-[6px] text-[12px] text-white flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: 'var(--color-accent)' }}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={1.6} />
            {saving ? 'Zapis…' : 'Zapisz'}
          </button>
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="overline">Kicker</span>
        <input
          value={kicker}
          onChange={(e) => setKicker(e.target.value)}
          className="h-9 px-3 rounded-[6px] border text-[12px] font-mono"
          style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-line-soft)' }}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="overline">Headline (otocz fragment *italic*)</span>
        <textarea
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          rows={2}
          className="px-3 py-2 rounded-[6px] border text-[20px] font-serif"
          style={{
            background: 'var(--color-bg-card)',
            borderColor: 'var(--color-line-soft)',
            fontFamily: 'var(--font-display)',
            lineHeight: 1.15,
          }}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="overline">Lede</span>
        <textarea
          value={lede}
          onChange={(e) => setLede(e.target.value)}
          rows={3}
          className="px-3 py-2 rounded-[6px] border text-[14px]"
          style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-line-soft)' }}
        />
      </label>

      {err && (
        <div className="text-[12px] px-3 py-2 rounded-[6px]"
             style={{ background: 'var(--color-accent-negative-bg)', color: 'var(--color-accent-negative)' }}>
          {err}
        </div>
      )}

      <div className="text-[11px]" style={{ color: 'var(--color-ink-tertiary)' }}>
        Zostawienie pustego pola = przywrócenie domyślnej treści generowanej z danych.
      </div>
    </div>
  );
}
