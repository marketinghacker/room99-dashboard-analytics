'use client';
import { useState } from 'react';

type Status = { statusId: number; label: string; isValidSale: boolean };

export default function StatusConfigPage() {
  const [key, setKey] = useState('');
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/statuses?key=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setStatuses(data.statuses);
    } catch (e) {
      setMsg(`Błąd: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/statuses?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statuses }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMsg('✓ Zapisano. Następny sync użyje nowych ustawień.');
    } catch (e) {
      setMsg(`Błąd: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: number) =>
    setStatuses(statuses.map((s) => (s.statusId === id ? { ...s, isValidSale: !s.isValidSale } : s)));

  const setAll = (v: boolean) => setStatuses(statuses.map((s) => ({ ...s, isValidSale: v })));

  return (
    <div className="p-8 max-w-3xl mx-auto font-[family-name:var(--font-text)]">
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] mb-1">
          Statusy zamówień — valid sale
        </h1>
        <p className="text-[13px] text-[var(--color-ink-tertiary)]">
          Zaznacz, które statusy z BaseLinker mają być liczone jako przychód.
          Ustawienia stosowane przy następnym sync (cron co 5 min lub backfill).
        </p>
      </div>

      <div className="card p-4 mb-4 flex gap-2">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="CRON_SECRET"
          className="flex-1 px-3 py-2 rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] text-[13px]"
        />
        <button
          onClick={load}
          disabled={loading || !key}
          className="px-4 py-2 rounded-[10px] bg-[var(--color-accent-primary)] text-white text-[13px] font-medium disabled:opacity-50"
        >
          Wczytaj
        </button>
      </div>

      {msg && (
        <div className="card p-3 mb-4 text-[13px]">{msg}</div>
      )}

      {statuses.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] text-[var(--color-ink-tertiary)]">
              {statuses.filter((s) => s.isValidSale).length} z {statuses.length} zaznaczonych
            </p>
            <div className="flex gap-1">
              <button onClick={() => setAll(true)} className="text-[12px] px-2 py-1 hover:underline">
                Zaznacz wszystkie
              </button>
              <button onClick={() => setAll(false)} className="text-[12px] px-2 py-1 hover:underline">
                Odznacz wszystkie
              </button>
            </div>
          </div>

          <div className="card overflow-hidden mb-4">
            <table className="w-full text-[13px]">
              <thead className="bg-[var(--color-bg-elevated)]">
                <tr>
                  <th className="px-4 py-2 text-left overline">ID</th>
                  <th className="px-4 py-2 text-left overline">Nazwa</th>
                  <th className="px-4 py-2 text-center overline">Valid sale</th>
                </tr>
              </thead>
              <tbody>
                {statuses.map((s) => (
                  <tr key={s.statusId} className="border-t border-[var(--color-border-subtle)]">
                    <td className="px-4 py-2 font-mono text-[var(--color-ink-tertiary)]">{s.statusId}</td>
                    <td className="px-4 py-2 font-medium">{s.label}</td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={s.isValidSale}
                        onChange={() => toggle(s.statusId)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={save}
            disabled={loading}
            className="px-4 py-2 rounded-[10px] bg-[var(--color-accent-positive)] text-white text-[13px] font-medium disabled:opacity-50"
          >
            Zapisz
          </button>
        </>
      )}
    </div>
  );
}
