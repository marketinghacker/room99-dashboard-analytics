'use client';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-glass-border bg-bg/70 backdrop-blur-xl" style={{ minHeight: 52 }}>
      <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between h-[52px]">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-amber-600 flex items-center justify-center shadow-md shadow-accent/20">
              <span className="text-black text-[14px] font-extrabold">R</span>
            </div>
          </div>
          <div>
            <div className="text-[15px] font-bold text-text tracking-tight leading-none">Room99</div>
            <div className="text-[10px] font-medium text-text-muted tracking-wide uppercase mt-0.5">Performance Dashboard</div>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            <div className="w-1.5 h-1.5 rounded-full bg-green shadow-sm shadow-green/50 animate-pulse" />
            <span>Live</span>
          </div>
        </div>
      </div>
    </header>
  );
}
