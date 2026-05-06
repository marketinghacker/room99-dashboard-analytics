// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Sparkline } from './Sparkline';

describe('Sparkline', () => {
  it('renders SVG with polyline for non-empty data', () => {
    const { container } = render(<Sparkline daily={[1, 5, 3, 8, 4]} />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('polyline')).toBeTruthy();
  });

  it('renders no polyline for empty data', () => {
    const { container } = render(<Sparkline daily={[]} />);
    expect(container.querySelector('polyline')).toBeFalsy();
  });

  it('uses sage stroke when trend is up', () => {
    const { container } = render(<Sparkline daily={[1, 2, 3, 4]} />);
    const line = container.querySelector('polyline')!;
    expect(line.getAttribute('stroke')).toBe('var(--color-accent-positive)');
  });

  it('uses terracotta stroke when trend is down', () => {
    const { container } = render(<Sparkline daily={[5, 4, 3, 2]} />);
    const line = container.querySelector('polyline')!;
    expect(line.getAttribute('stroke')).toBe('var(--color-accent-negative)');
  });
});
