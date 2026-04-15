'use client';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border px-5 py-2.5" style={{ minHeight: 48 }}>
      <div className="max-w-[1280px] mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-white text-[13px] font-bold tracking-tight">R</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[14px] text-text leading-none tracking-tight">Room99</span>
            <span className="text-[10px] text-text-muted leading-none mt-0.5">Performance Dashboard</span>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          <span className="text-[11px] text-text-muted">
            Okres: 1–15 kwi 2026
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" title="Dane aktualne" />
        </div>
      </div>
    </header>
  );
}
