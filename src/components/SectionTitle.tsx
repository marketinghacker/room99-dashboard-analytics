interface SectionTitleProps {
  children: React.ReactNode;
  subtitle?: string;
  className?: string;
}

export default function SectionTitle({ children, subtitle, className = '' }: SectionTitleProps) {
  return (
    <div className={className}>
      <h2 className="text-[16px] font-bold text-text pb-2 border-b-2 border-primary mb-4">
        {children}
      </h2>
      {subtitle && <p className="text-[13px] text-text-secondary -mt-2 mb-3">{subtitle}</p>}
    </div>
  );
}
