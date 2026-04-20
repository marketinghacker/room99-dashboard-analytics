'use client';

import { useState } from 'react';
import { Select, type SelectOption } from '@/components/ui/Select';
import { DateRangePicker, periodKeyToRange } from '@/components/ui/DateRangePicker';
import { useFilters } from '@/stores/filters';
import { resolvePeriod, resolveCompare, type PeriodKey, type CompareKey } from '@/lib/periods';
import { formatDateRangePL } from '@/lib/format';
import { Calendar } from 'lucide-react';

type PeriodGroup = 'days' | 'weeks' | 'months' | 'other';
type Preset = { value: string; label: string; group: PeriodGroup };

const PRESETS: Preset[] = [
  // Dni
  { value: 'today',         label: 'Dzisiaj',            group: 'days' },
  { value: 'yesterday',     label: 'Wczoraj',            group: 'days' },
  { value: 'last_7d',       label: 'Ostatnie 7 dni',     group: 'days' },
  { value: 'last_30d',      label: 'Ostatnie 30 dni',    group: 'days' },
  { value: 'last_90d',      label: 'Ostatnie 90 dni',    group: 'days' },
  // Tygodnie i miesiące
  { value: 'this_week',     label: 'Ten tydzień',        group: 'weeks' },
  { value: 'last_week',     label: 'Poprzedni tydzień',  group: 'weeks' },
  { value: 'this_month',    label: 'Ten miesiąc',        group: 'months' },
  { value: 'last_month',    label: 'Poprzedni miesiąc',  group: 'months' },
  // Kwartały / rok
  { value: 'this_quarter',  label: 'Ten kwartał',        group: 'other' },
  { value: 'last_quarter',  label: 'Poprzedni kwartał',  group: 'other' },
  { value: 'ytd',           label: 'Od początku roku',   group: 'other' },
];

const GROUP_LABEL: Record<PeriodGroup, string> = {
  days:   'Dni',
  weeks:  'Tygodnie',
  months: 'Miesiące',
  other:  'Kwartały / rok',
};

const COMPARES: Array<{ value: CompareKey; label: string }> = [
  { value: 'previous_period',          label: 'Poprzedni okres' },
  { value: 'same_period_last_year',    label: 'Rok temu' },
  { value: 'same_period_last_quarter', label: 'Poprzedni kwartał' },
  { value: 'none',                     label: 'Bez porównania' },
];

export function FilterBar() {
  const { period, compare, setPeriod, setCompare } = useFilters();
  const [showPicker, setShowPicker] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  const isCustom = typeof period === 'string' && period.startsWith('custom_');
  const periodRange = resolvePeriod(period);

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

  function pick(v: string) {
    setPeriod(v as PeriodKey);
    setShowPicker(false);
    setShowCustom(false);
  }

  const grouped = (['days', 'weeks', 'months', 'other'] as const).map((g) => ({
    group: g,
    items: PRESETS.filter((p) => p.group === g),
  }));

  return (
    <div className="flex items-center gap-2 relative whitespace-nowrap">
      {/* Period pill */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="h-8 px-3 flex items-center gap-2 rounded-[6px] text-[12px] border transition-colors whitespace-nowrap"
          style={{
            background: 'var(--color-bg-card)',
            borderColor: 'var(--color-line-soft)',
            color: 'var(--color-ink-primary)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-line-hard)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-line-soft)')}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0" strokeWidth={1.4} />
          <span className="numeric font-medium">
            {formatDateRangePL(periodRange.start, periodRange.end)}
          </span>
        </button>
        {showPicker && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => { setShowPicker(false); setShowCustom(false); }}
            />
            <div
              className="absolute right-0 top-full mt-2 z-50 flex"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-line-soft)',
                borderRadius: 10,
                boxShadow: 'var(--shadow-popover)',
                padding: 8,
              }}
            >
              {/* Grouped preset column */}
              <div className="flex flex-col w-[200px] gap-0.5">
                {grouped.map(({ group, items }) => (
                  <div key={group} className="mb-1">
                    <div
                      className="px-2 pt-1.5 pb-1 font-mono"
                      style={{
                        fontSize: 9,
                        letterSpacing: '0.14em',
                        color: 'var(--color-ink-tertiary)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {GROUP_LABEL[group]}
                    </div>
                    {items.map((p) => {
                      const selected = !isCustom && p.value === period;
                      return (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => pick(p.value)}
                          className="w-full text-left px-2 py-1 rounded-[5px] text-[12.5px] transition-colors"
                          style={{
                            background: selected ? 'var(--color-bg-elevated)' : 'transparent',
                            color: selected ? 'var(--color-ink-primary)' : 'var(--color-ink-secondary)',
                            fontWeight: selected ? 500 : 400,
                          }}
                          onMouseEnter={(e) => {
                            if (!selected) e.currentTarget.style.background = 'var(--color-bg-hover)';
                          }}
                          onMouseLeave={(e) => {
                            if (!selected) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setShowCustom((v) => !v)}
                  className="mt-2 pt-2 border-t px-2 py-1.5 rounded-[5px] text-[12.5px] text-left transition-colors"
                  style={{
                    borderColor: 'var(--color-line-soft)',
                    color: isCustom || showCustom ? 'var(--color-accent)' : 'var(--color-ink-secondary)',
                    fontWeight: isCustom || showCustom ? 500 : 400,
                  }}
                >
                  Własny zakres…
                </button>
              </div>

              {/* Calendar only when custom is explicitly opened */}
              {(showCustom || isCustom) && (
                <div
                  className="pl-3 ml-3 border-l"
                  style={{ borderColor: 'var(--color-line-soft)' }}
                >
                  <DateRangePicker
                    initial={isCustom ? periodKeyToRange(period) : undefined}
                    onSelect={(key) => pick(key)}
                    onClose={() => { setShowPicker(false); setShowCustom(false); }}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Compare pill */}
      <div className="relative w-[160px] shrink-0">
        <Select
          value={compare}
          options={compareOptions}
          onChange={(v) => setCompare(v as CompareKey)}
        />
      </div>
    </div>
  );
}
