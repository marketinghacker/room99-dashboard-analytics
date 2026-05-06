import { memo } from 'react';

export const Sparkline = memo(function Sparkline({
  daily, width = 56, height = 18,
}: { daily: number[]; width?: number; height?: number }) {
  if (daily.length < 2) return <svg width={width} height={height} />;
  const max = Math.max(...daily, 1);
  const min = Math.min(...daily, 0);
  const range = max - min || 1;
  const stepX = width / (daily.length - 1);
  const points = daily
    .map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(' ');
  const mid = Math.floor(daily.length / 2);
  const firstAvg = daily.slice(0, mid).reduce((a, b) => a + b, 0) / Math.max(mid, 1);
  const secondAvg = daily.slice(mid).reduce((a, b) => a + b, 0) / Math.max(daily.length - mid, 1);
  const trendUp = secondAvg >= firstAvg;
  const stroke = trendUp ? 'var(--color-accent-positive)' : 'var(--color-accent-negative)';
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.25}
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
});
