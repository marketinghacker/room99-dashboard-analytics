import { Shield } from 'lucide-react';
import { loadMeta } from '@/lib/data-loader';

export default function Header() {
  const meta = loadMeta();
  const lastUpdated = meta?.lastUpdated ?? '---';

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between bg-card border-b border-border px-4 py-2"
      style={{ minHeight: 49 }}
    >
      {/* Left: brand */}
      <div className="flex items-center gap-2 shrink-0">
        <Shield className="h-5 w-5 text-primary" />
        <span className="font-bold text-[15px] text-text">Room99</span>
      </div>

      {/* Center: title */}
      <div className="flex flex-col items-center text-center flex-1 min-w-0 px-4">
        <h1 className="text-[14px] font-semibold text-text leading-tight truncate">
          Room99 — Dashboard Performance Marketing
        </h1>
        <p className="text-[11px] text-text-secondary leading-tight truncate">
          Tekstylia Domowe: Zasłony &bull; Firany &bull; Narzuty &bull; Pościele
        </p>
      </div>

      {/* Right: last updated */}
      <div className="shrink-0 text-right">
        <span className="text-[11px] text-text-secondary whitespace-nowrap">
          Ostatnia aktualizacja: {lastUpdated}
        </span>
      </div>
    </header>
  );
}
