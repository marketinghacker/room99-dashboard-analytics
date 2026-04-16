interface ChangeIndicatorProps {
  value: number | string;
  direction?: 'up' | 'down' | 'neutral';
  size?: 'sm' | 'md';
}

export default function ChangeIndicator({ value, direction, size = 'md' }: ChangeIndicatorProps) {
  const dir = direction ?? (typeof value === 'number' ? value > 0 ? 'up' : value < 0 ? 'down' : 'neutral' : 'neutral');
  const arrow = dir === 'up' ? '\u2191' : dir === 'down' ? '\u2193' : '\u2192';
  const displayValue = typeof value === 'number'
    ? `${arrow} ${Math.abs(value).toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`
    : `${arrow} ${value}`;

  const colorClasses = {
    up: 'bg-green-bg text-green',
    down: 'bg-red-bg text-red',
    neutral: 'bg-wire-bg text-text-secondary',
  }[dir];

  const sizeClasses = size === 'sm' ? 'text-[12px] px-2 py-0.5' : 'text-[12px] px-2 py-0.5';

  return (
    <span className={`inline-flex items-center gap-1 rounded-[10px] font-semibold ${colorClasses} ${sizeClasses}`}>
      {displayValue}
    </span>
  );
}
