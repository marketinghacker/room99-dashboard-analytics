'use client';
import { useState } from 'react';

export function ExportModal({
  open, onClose, start, end, channels,
}: {
  open: boolean;
  onClose: () => void;
  start: string;
  end: string;
  channels?: string[];
}) {
  const [format, setFormat] = useState<'csv' | 'xlsx'>('xlsx');
  if (!open) return null;

  const params = new URLSearchParams({ format, start, end });
  if (channels && channels.length) params.set('channels', channels.join(','));
  const href = `/api/data/sales-tree/export?${params.toString()}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-bg-card)] border border-[var(--color-line-soft)] rounded-lg shadow-[var(--shadow-popover)] p-6 w-[400px]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[16px] font-semibold mb-4">Eksport sprzedaży produktowej</h3>

        <div className="text-[12px] text-[var(--color-ink-tertiary)] mb-4">
          Okres: <strong className="text-[var(--color-ink-secondary)]">{start} → {end}</strong>
        </div>

        <fieldset className="space-y-2 mb-6">
          <legend className="text-[12px] font-medium mb-2">Format</legend>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="format"
              value="xlsx"
              checked={format === 'xlsx'}
              onChange={() => setFormat('xlsx')}
              className="mt-1"
            />
            <div>
              <div className="text-[13px] font-medium">XLSX (Excel)</div>
              <div className="text-[11px] text-[var(--color-ink-tertiary)]">
                Drzewo z poziomami + płaska lista, kolory, formuła zamiany
              </div>
            </div>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="format"
              value="csv"
              checked={format === 'csv'}
              onChange={() => setFormat('csv')}
              className="mt-1"
            />
            <div>
              <div className="text-[13px] font-medium">CSV (płaska lista)</div>
              <div className="text-[11px] text-[var(--color-ink-tertiary)]">
                Średnik jako separator, BOM dla polskich znaków, kompatybilny z Excel
              </div>
            </div>
          </label>
        </fieldset>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-[13px] text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)]"
          >
            Anuluj
          </button>
          <a
            href={href}
            download
            onClick={onClose}
            className="px-4 py-1.5 text-[13px] font-medium bg-[var(--color-accent)] text-white rounded-md hover:opacity-90"
          >
            Pobierz
          </a>
        </div>
      </div>
    </div>
  );
}
