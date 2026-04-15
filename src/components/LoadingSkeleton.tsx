'use client';

interface LoadingSkeletonProps {
  /** Number of KPI cards to show */
  cards?: number;
  /** Show a table skeleton below cards */
  showTable?: boolean;
  /** Show a chart skeleton */
  showChart?: boolean;
}

function SkeletonPulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`animate-pulse bg-border/40 rounded ${className ?? ''}`} style={style} />
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
      <SkeletonPulse className="h-3 w-20" />
      <SkeletonPulse className="h-8 w-28" />
      <SkeletonPulse className="h-5 w-16 rounded-full" />
    </div>
  );
}

function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 border-b border-border bg-wire-bg">
        {[120, 80, 80, 80, 60].map((w, i) => (
          <SkeletonPulse key={i} className="h-3" style={{ width: w }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b border-border last:border-b-0">
          {[120, 80, 80, 80, 60].map((w, j) => (
            <SkeletonPulse key={j} className="h-3" style={{ width: w }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <SkeletonPulse className="h-4 w-32 mb-4" />
      <div className="flex items-end gap-2 h-[200px]">
        {Array.from({ length: 12 }).map((_, i) => (
          <SkeletonPulse
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${30 + Math.random() * 70}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function LoadingSkeleton({
  cards = 5,
  showTable = false,
  showChart = false,
}: LoadingSkeletonProps) {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* KPI cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Chart skeleton */}
      {showChart && <SkeletonChart />}

      {/* Table skeleton */}
      {showTable && <SkeletonTable />}
    </div>
  );
}

/** Inline skeleton for single values */
export function InlineSkeleton({ width = 60 }: { width?: number }) {
  return <SkeletonPulse className="h-4 inline-block align-middle" style={{ width }} />;
}
