// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SalesTreeRow } from './SalesTreeRow';

const baseNode = {
  label: 'NARZUTA',
  depth: 1,
  metrics: { revenue: 1234.56, quantity: 5, orders: 3, revenuePrev: 1000, change: 23.456 },
  daily: [10, 20, 30],
  hasChildren: true,
  expanded: false,
};

describe('SalesTreeRow', () => {
  it('renders label and quantity', () => {
    render(<SalesTreeRow {...baseNode} onToggle={() => {}} />);
    expect(screen.getByText('NARZUTA')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('formats revenue with PLN', () => {
    const { container } = render(<SalesTreeRow {...baseNode} onToggle={() => {}} />);
    // Polish locale formatting: 1 234,56 zł or "1 234,56 PLN" — accept either, just check digits + separator
    expect(container.textContent).toMatch(/1\s?234[,.]56/);
  });

  it('calls onToggle when expand caret clicked', () => {
    const onToggle = vi.fn();
    render(<SalesTreeRow {...baseNode} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /expand|collapse/i }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('omits caret when no children', () => {
    render(<SalesTreeRow {...baseNode} hasChildren={false} onToggle={() => {}} />);
    expect(screen.queryByRole('button', { name: /expand|collapse/i })).toBeNull();
  });

  it('marks change as positive when above 0.5%', () => {
    const { container } = render(<SalesTreeRow {...baseNode} onToggle={() => {}} />);
    expect(container.querySelector('[data-change="positive"]')).toBeTruthy();
  });

  it('marks change as negative when below -0.5%', () => {
    const props = { ...baseNode, metrics: { ...baseNode.metrics, change: -10 } };
    const { container } = render(<SalesTreeRow {...props} onToggle={() => {}} />);
    expect(container.querySelector('[data-change="negative"]')).toBeTruthy();
  });
});
