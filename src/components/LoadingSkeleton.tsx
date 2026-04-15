'use client';

interface LoadingSkeletonProps {
  cards?: number;
  showTable?: boolean;
  showChart?: boolean;
}

function Pulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-lg ${className ?? ''}`}
      style={{
        ...style,
        background: 'linear-gradient(90deg, var(--surface) 25%, var(--surface-hover) 50%, var(--surface) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s ease-in-out infinite',
      }}
    />
  );
}

function SkeletonCard() {
  return (
    <div className="glass-card p-5 flex flex-col gap-3">
      <Pulse className="h-2.5 w-16" />
      <Pulse className="h-7 w-24" />
      <Pulse className="h-4 w-14" />
    </div>
  );
}

function SkeletonTable({ rows = 4 }: { rows?: number }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="flex gap-6 px-5 py-3.5 border-b border-glass-border">
        {[100, 70, 60, 80].map((w, i) => (
          <Pulse key={i} className="h-2.5" style={{ width: w }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-6 px-5 py-3.5 border-b border-glass-border/50">
          {[100, 70, 60, 80].map((w, j) => (
            <Pulse key={j} className="h-3" style={{ width: w }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function LoadingSkeleton({ cards = 5, showTable = false }: LoadingSkeletonProps) {
  return (
    <div className="space-y-6 animate-fade-up">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: cards }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      {showTable && <SkeletonTable />}
    </div>
  );
}

export function InlineSkeleton({ width = 60 }: { width?: number }) {
  return <Pulse className="h-4 inline-block align-middle" style={{ width }} />;
}
