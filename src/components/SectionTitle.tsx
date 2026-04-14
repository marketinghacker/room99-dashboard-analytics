interface SectionTitleProps {
  children: React.ReactNode;
  subtitle?: string;
  className?: string;
}

export default function SectionTitle({ children, subtitle, className = '' }: SectionTitleProps) {
  return (
    <div className={`mb-4 ${className}`}>
      <h2 className="text-[16px] font-bold text-text pb-2 border-b-2 border-primary">
        {children}
      </h2>
      {subtitle && (
        <p className="text-[12px] text-text-secondary mt-1">{subtitle}</p>
      )}
    </div>
  );
}
