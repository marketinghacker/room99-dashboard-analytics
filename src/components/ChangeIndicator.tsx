interface ChangeIndicatorProps {
  value: number | string;
  direction?: 'up' | 'down' | 'neutral';
  size?: 'sm' | 'md';
}

export default function ChangeIndicator({
  value,
  direction,
  size = 'md',
}: ChangeIndicatorProps) {
  const dir =
    direction ??
    (typeof value === 'number'
      ? value > 0 ? 'up' : value < 0 ? 'down' : 'neutral'
      : 'neutral');

  const displayValue =
    typeof value === 'number'
      ? `${dir === 'up' ? '+' : ''}${value.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`
      : String(value);

  const styles = {
    up: 'text-green bg-green-bg',
    down: 'text-red bg-red-bg',
    neutral: 'text-text-muted bg-wire-bg',
  }[dir];

  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-[12px] px-2.5 py-0.5';

  return (
    <span className={`inline-flex items-center rounded-md font-semibold tabular-nums ${styles} ${sizeClass}`}>
      {displayValue}
    </span>
  );
}
