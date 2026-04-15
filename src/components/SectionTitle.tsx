interface SectionTitleProps {
  children: React.ReactNode;
  subtitle?: string;
  className?: string;
}

export default function SectionTitle({ children, subtitle, className = '' }: SectionTitleProps) {
  return (
    <div className={`${className}`}>
      <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-text-secondary">
        {children}
      </h2>
      {subtitle && (
        <p className="text-[12px] text-text-muted mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}
