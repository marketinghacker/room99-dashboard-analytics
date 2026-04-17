'use client';

/**
 * Disable SSR for the dashboard. Everything here depends on:
 *  - session cookie (not available server-side on the edge)
 *  - SWR cache (client-only)
 *  - localStorage (role preview, tab, period hash)
 *  - `document` (role dataset, scrollY, DateTime formatters)
 *
 * Rendering it server-side just produces a flashing skeleton that then
 * hydrates to a completely different tree — root cause of React error #418
 * we chased for an hour. ssr: false short-circuits that whole class of bug.
 */
import dynamic from 'next/dynamic';

const DashboardShell = dynamic(
  () => import('@/components/shell/DashboardShell').then((m) => ({ default: m.DashboardShell })),
  { ssr: false, loading: () => <DashboardSkeleton /> },
);

function DashboardSkeleton() {
  return (
    <div className="min-h-screen">
      {/* sidebar placeholder */}
      <div
        className="fixed top-0 left-0 bottom-0 w-[260px]"
        style={{ background: 'var(--color-bg-side)', borderRight: '1px solid var(--color-line-soft)' }}
      />
      <div className="pl-[260px]">
        <div className="h-14" style={{ background: 'var(--color-bg-base)', borderBottom: '1px solid var(--color-line-soft)' }} />
        <main style={{ padding: '28px 40px 80px' }} className="max-w-[1440px] mx-auto">
          <div className="skeleton h-[32px] w-[200px] mb-3" />
          <div className="skeleton h-[80px] w-full" />
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  return <DashboardShell />;
}
