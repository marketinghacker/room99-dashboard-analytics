'use client';

import useSWR from 'swr';
import { useFilters } from '@/stores/filters';
import { resolvePeriod, resolveCompare } from '@/lib/periods';
import { SalesTree } from './sales-tree/SalesTree';
import { LoadingCard, ErrorCard, EmptyCard } from '@/components/primitives/StateCard';
import type { ChannelNode } from '@/lib/sales-tree';

type Resp = {
  channels: ChannelNode[];
  period: { start: string; end: string };
  compare: { start: string; end: string };
  count: number;
};

export function SalesTreeTab() {
  const { period, compare } = useFilters();
  const range = resolvePeriod(period);
  const cmp = resolveCompare(range, compare);

  const params = new URLSearchParams({ start: range.start, end: range.end });
  if (cmp) {
    params.set('compareStart', cmp.start);
    params.set('compareEnd', cmp.end);
  }

  const { data, error, isLoading } = useSWR<Resp>(
    `/api/data/sales-tree?${params.toString()}`,
    (u: string) => fetch(u).then((r) => r.json()),
  );

  if (isLoading) return <LoadingCard />;
  if (error) return <ErrorCard error="Nie udalo sie pobrac sprzedazy produktowej" />;
  if (!data?.channels?.length) return <EmptyCard title="Brak sprzedazy w wybranym okresie" />;

  return (
    <div className="space-y-3">
      <div className="text-[12px] text-[var(--color-ink-tertiary)] flex items-center gap-3">
        <span>
          Okres: <strong className="text-[var(--color-ink-secondary)]">{data.period.start} → {data.period.end}</strong>
        </span>
        <span>·</span>
        <span>
          Porównanie: <strong className="text-[var(--color-ink-secondary)]">{data.compare.start} → {data.compare.end}</strong>
        </span>
        <span>·</span>
        <span>{data.count} produktów</span>
      </div>
      <SalesTree channels={data.channels} start={data.period.start} end={data.period.end} />
    </div>
  );
}
