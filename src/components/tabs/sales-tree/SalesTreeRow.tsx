import { Sparkline } from '@/components/charts/Sparkline';

const fmtPLN = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });
const fmtInt = new Intl.NumberFormat('pl-PL');

export type SalesTreeRowProps = {
  label: string;
  sublabel?: string;
  depth: number;
  metrics: { revenue: number; quantity: number; orders: number; revenuePrev: number; change: number };
  daily: number[];
  hasChildren: boolean;
  expanded: boolean;
  kind?: 'product' | 'more';
  collectionId?: string;
  onToggle: () => void;
  onShowMore?: (collectionId: string) => void;
};

export function SalesTreeRow(p: SalesTreeRowProps) {
  const { depth, metrics, hasChildren, expanded, kind } = p;
  const indent = depth * 20;

  if (kind === 'more') {
    return (
      <div
        className="grid items-center px-3 border-b border-[var(--color-line-soft)] hover:bg-[var(--color-bg-elevated)]"
        style={{
          gridTemplateColumns: 'minmax(280px, 1fr) 56px 80px 80px 110px 80px',
          paddingLeft: 12 + indent,
          height: 32,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-4" />
          <button
            type="button"
            onClick={() => p.collectionId && p.onShowMore?.(p.collectionId)}
            className="text-[12px] text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)] underline-offset-2 hover:underline"
          >
            {p.label}
          </button>
        </div>
        <div />
        <div />
        <div />
        <div />
        <div />
      </div>
    );
  }

  const changeSign = metrics.change > 0.5 ? 'positive' : metrics.change < -0.5 ? 'negative' : 'neutral';
  const isLeaf = !hasChildren;
  const changeColor = changeSign === 'positive'
    ? 'text-[var(--color-accent-positive)]'
    : changeSign === 'negative'
      ? 'text-[var(--color-accent-negative)]'
      : 'text-[var(--color-ink-tertiary)]';

  return (
    <div
      className="grid items-center px-3 border-b border-[var(--color-line-soft)] hover:bg-[var(--color-bg-elevated)]"
      style={{
        gridTemplateColumns: 'minmax(280px, 1fr) 56px 80px 80px 110px 80px',
        paddingLeft: 12 + indent,
        height: isLeaf ? 32 : 40,
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {hasChildren ? (
          <button
            type="button"
            aria-label={expanded ? 'collapse' : 'expand'}
            onClick={p.onToggle}
            className="w-4 h-4 flex items-center justify-center text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink-primary)]"
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className={`truncate ${depth === 0 ? 'font-semibold' : depth === 3 ? 'text-[13px]' : ''}`}>
          {p.label}
        </span>
        {p.sublabel && <span className="text-[11px] text-[var(--color-ink-tertiary)] ml-2 shrink-0">{p.sublabel}</span>}
      </div>
      <Sparkline daily={p.daily} />
      <div className="text-right tabular text-[13px]">{fmtInt.format(metrics.quantity)}</div>
      <div className="text-right tabular text-[13px]">{fmtInt.format(metrics.orders)}</div>
      <div className="text-right tabular text-[13px] font-medium">{fmtPLN.format(metrics.revenue)}</div>
      <div className={`text-right tabular text-[12px] ${changeColor}`} data-change={changeSign}>
        {metrics.change > 0 ? '+' : ''}{metrics.change.toFixed(1)}%
      </div>
    </div>
  );
}
