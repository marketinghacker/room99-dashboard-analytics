'use client';

import { useState } from 'react';
import { Select, type SelectOption } from '@/components/ui/Select';
import { DateRangePicker, periodKeyToRange } from '@/components/ui/DateRangePicker';
import { useFilters } from '@/stores/filters';
import { resolvePeriod, resolveCompare, type PeriodKey, type CompareKey } from '@/lib/periods';
import { formatDateRangePL } from '@/lib/format';
import { Calendar } from 'lucide-react';

const PERIODS: Array<{ value: string; label: string }> = [
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
  { value: '__custom__', label: 'Zakres niestandardowy…' },
];

const COMPARES: Array<{ value: CompareKey; label: string }> = [
  { value: 'previous_period', label: 'Poprzedni okres' },
  { value: 'same_period_last_year', label: 'Ten sam okres rok temu' },
  { value: 'same_period_last_quarter', label: 'Ten sam okres poprzedni kwartał' },
  { value: 'none', label: 'Bez porównania' },
];

export function FilterBar() {
  const { period, compare, setPeriod, setCompare } = useFilters();
  const [showPicker, setShowPicker] = useState(false);

  const isCustom = typeof period === 'string' && period.startsWith('custom_');
  const periodRange = resolvePeriod(period);
  const compareRange = resolveCompare(periodRange, compare);

  const selectValue = isCustom ? '__custom__' : period;

  const periodOptions: SelectOption[] = PERIODS.map((p) => {
    if (p.value === '__custom__') {
      return {
        value: '__custom__',
        label: p.label,
        hint: isCustom ? formatDateRangePL(periodRange.start, periodRange.end) : undefined,
      };
    }
    const r = resolvePeriod(p.value as PeriodKey);
    return {
      value: p.value,
      label: p.label,
      hint: formatDateRangePL(r.start, r.end),
    };
  });

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

  const onPeriodChange = (v: string) => {
    if (v === '__custom__') {
      setShowPicker(true);
    } else {
      setPeriod(v as PeriodKey);
      setShowPicker(false);
    }
  };

  return (
    <div className="flex items-center gap-2 relative">
      {/* Period pill */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="h-8 px-3 flex items-center gap-2 rounded-[6px] text-[12px] border transition-colors"
          style={{
            background: 'var(--color-bg-card)',
            borderColor: 'var(--color-line-soft)',
            color: 'var(--color-ink-primary)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-line-hard)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-line-soft)')}
        >
          <Calendar className="w-3.5 h-3.5" strokeWidth={1.4} />
          <span className="numeric font-medium">
            {formatDateRangePL(periodRange.start, periodRange.end)}
          </span>
          <span
            className="font-mono text-[10px] tracking-[0.06em] uppercase"
            style={{ color: 'var(--color-ink-tertiary)' }}
          >
            {PERIODS.find((p) => p.value === selectValue)?.label.slice(0, 8) ?? ''}
          </span>
        </button>
        {showPicker && (
          <div className="absolute right-0 top-full mt-2 z-50 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <div className="w-[220px]">
              <Select label="Okres" value={selectValue} options={periodOptions} onChange={onPeriodChange} />
            </div>
            {selectValue === '__custom__' && (
              <div className="z-50">
                <DateRangePicker
                  initial={isCustom ? periodKeyToRange(period) : undefined}
                  onSelect={(key) => {
                    setPeriod(key as PeriodKey);
                    setShowPicker(false);
                  }}
                  onClose={() => setShowPicker(false)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Compare pill */}
      <div className="relative min-w-[200px]">
        <Select
          value={compare}
          options={compareOptions}
          onChange={(v) => setCompare(v as CompareKey)}
        />
      </div>

      {compareRange && (
        <span
          className="font-mono text-[10px] tracking-[0.06em] uppercase"
          style={{ color: 'var(--color-ink-tertiary)' }}
        >
          vs {formatDateRangePL(compareRange.start, compareRange.end)}
        </span>
      )}
    </div>
  );
}
