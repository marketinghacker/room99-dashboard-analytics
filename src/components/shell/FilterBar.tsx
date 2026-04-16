'use client';

import { Select, type SelectOption } from '@/components/ui/Select';
import { useFilters } from '@/stores/filters';
import { resolvePeriod, resolveCompare, type PeriodKey, type CompareKey } from '@/lib/periods';
import { formatDateRangePL } from '@/lib/format';
import { RefreshCw } from 'lucide-react';
import { mutate } from 'swr';
import { useState } from 'react';

const PERIODS: Array<{ value: PeriodKey; label: string }> = [
  { value: 'today', label: 'Dzisiaj' },
  { value: 'yesterday', label: 'Wczoraj' },
  { value: 'last_7d', label: 'Ostatnie 7 dni' },
  { value: 'last_30d', label: 'Ostatnie 30 dni' },
  { value: 'last_90d', label: 'Ostatnie 90 dni' },
  { value: 'this_week', label: 'Ten tydzień' },
  { value: 'last_week', label: 'Poprzedni tydzień' },
  { value: 'this_month', label: 'Ten miesiąc' },
  { value: 'last_month', label: 'Poprzedni miesiąc' },
  { value: 'this_quarter', label: 'Ten kwartał' },
  { value: 'last_quarter', label: 'Poprzedni kwartał' },
  { value: 'ytd', label: 'Od początku roku' },
];

const COMPARES: Array<{ value: CompareKey; label: string }> = [
  { value: 'previous_period', label: 'Poprzedni okres' },
  { value: 'same_period_last_year', label: 'Ten sam okres rok temu' },
  { value: 'same_period_last_quarter', label: 'Ten sam okres poprzedni kwartał' },
  { value: 'none', label: 'Bez porównania' },
];

export function FilterBar() {
  const { period, compare, setPeriod, setCompare } = useFilters();
  const [refreshing, setRefreshing] = useState(false);

  const periodRange = resolvePeriod(period);
  const compareRange = resolveCompare(periodRange, compare);

  const periodOptions: SelectOption[] = PERIODS.map((p) => ({
    value: p.value,
    label: p.label,
    hint: formatDateRangePL(resolvePeriod(p.value).start, resolvePeriod(p.value).end),
  }));

  const compareOptions: SelectOption[] = COMPARES.map((c) => ({
    value: c.value,
    label: c.label,
    hint:
      c.value === 'none'
        ? undefined
        : (() => {
            const r = resolveCompare(periodRange, c.value);
            return r ? formatDateRangePL(r.start, r.end) : undefined;
          })(),
  }));

  const handleRefresh = async () => {
    setRefreshing(true);
    await mutate(() => true, undefined, { revalidate: true });
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select
        label="Okres"
        value={period}
        options={periodOptions}
        onChange={(v) => setPeriod(v as PeriodKey)}
        className="min-w-[200px]"
      />
      <Select
        label="Porównanie"
        value={compare}
        options={compareOptions}
        onChange={(v) => setCompare(v as CompareKey)}
        className="min-w-[220px]"
      />

      <div className="flex flex-col gap-1 ml-1">
        <span className="overline">Wybrany zakres</span>
        <div className="flex items-center gap-2 h-9 px-3 rounded-[10px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
          <span className="text-[13px] font-medium text-[var(--color-ink-primary)] numeric">
            {formatDateRangePL(periodRange.start, periodRange.end)}
          </span>
          {compareRange && (
            <span className="text-[11px] text-[var(--color-ink-tertiary)] numeric">
              vs {formatDateRangePL(compareRange.start, compareRange.end)}
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleRefresh}
        className="ml-auto h-9 px-3 flex items-center gap-1.5 rounded-[10px] text-[13px] font-medium text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
        title="Odśwież dane"
      >
        <RefreshCw className={refreshing ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />
        <span>Odśwież</span>
      </button>
    </div>
  );
}
