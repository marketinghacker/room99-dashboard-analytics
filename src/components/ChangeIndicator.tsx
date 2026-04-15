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
    up: 'text-green bg-green-subtle',
    down: 'text-red bg-red-subtle',
    neutral: 'text-text-muted bg-surface',
  }[dir];

  const sizeClass = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-bold tabular-nums ${styles} ${sizeClass}`}>
      <span className="text-[8px]">{dir === 'up' ? '▲' : dir === 'down' ? '▼' : '●'}</span>
      {displayValue}
    </span>
  );
}
