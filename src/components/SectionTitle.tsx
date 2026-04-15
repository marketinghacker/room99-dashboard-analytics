interface SectionTitleProps {
  children: React.ReactNode;
  subtitle?: string;
  className?: string;
}

export default function SectionTitle({ children, subtitle, className = '' }: SectionTitleProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="w-1 h-4 rounded-full bg-accent" />
      <div>
        <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-text-secondary">
          {children}
        </h2>
        {subtitle && (
          <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
