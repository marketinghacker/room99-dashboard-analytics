import type { ReactNode } from 'react';

interface KPIGridProps {
  columns: 2 | 3 | 4;
  children: ReactNode;
}

const gridColsMap = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
} as const;

export default function KPIGrid({ columns, children }: KPIGridProps) {
  return (
    <div className={`grid gap-4 ${gridColsMap[columns]}`}>
      {children}
    </div>
  );
}
