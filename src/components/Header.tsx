'use client';

export default function Header() {
  return (
    <header className="sticky top-0 z-[100] bg-white border-b border-border flex items-center gap-4 px-6 py-3">
      <div className="text-[14px] text-text-secondary font-medium flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/></svg>
        Room99
      </div>
      <div className="flex-1">
        <div className="text-[16px] font-semibold text-text">Room99 — Dashboard Performance Marketing</div>
        <div className="text-[12px] text-text-secondary">Tekstylia Domowe: Zaslony &bull; Firany &bull; Narzuty &bull; Posciele</div>
      </div>
    </header>
  );
}
