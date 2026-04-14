import ChangeIndicator from './ChangeIndicator';

interface KPICardProps {
  label: string;
  value: string;
  change?: number | string;
  changeDirection?: 'up' | 'down' | 'neutral';
  prefix?: string;
  suffix?: string;
}

export default function KPICard({
  label,
  value,
  change,
  changeDirection,
  prefix,
  suffix,
}: KPICardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1">
      {/* Header label */}
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
        {label}
      </span>

      {/* Main value */}
      <div className="text-[28px] font-bold leading-tight text-text">
        {prefix && (
          <span className="text-[18px] font-semibold text-text-secondary mr-0.5">
            {prefix}
          </span>
        )}
        {value}
        {suffix && (
          <span className="text-[16px] font-semibold text-text-secondary ml-1">
            {suffix}
          </span>
        )}
      </div>

      {/* Change indicator */}
      {change !== undefined && (
        <div className="mt-1">
          <ChangeIndicator value={change} direction={changeDirection} size="sm" />
        </div>
      )}
    </div>
  );
}
