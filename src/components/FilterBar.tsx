import type { ReactNode } from 'react';

interface FilterBarProps {
  period: string;
  comparison: string;
  extra?: ReactNode;
}

export default function FilterBar({ period, comparison, extra }: FilterBarProps) {
  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3 flex flex-wrap items-center gap-3 text-[12px]">
      {/* Period */}
      <div className="flex items-center gap-2">
        <span className="text-text-secondary font-medium">Okres:</span>
        <div className="bg-wire-bg border border-border rounded px-2.5 py-1 text-text font-medium select-none">
          {period}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-border" />

      {/* Comparison */}
      <div className="flex items-center gap-2">
        <span className="text-text-secondary font-medium">Porównanie:</span>
        <div className="bg-wire-bg border border-border rounded px-2.5 py-1 text-text font-medium select-none">
          {comparison}
        </div>
      </div>

      {/* Optional extra controls */}
      {extra && (
        <>
          <div className="w-px h-5 bg-border" />
          {extra}
        </>
      )}
    </div>
  );
}
