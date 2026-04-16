import { create } from 'zustand';
import type { PeriodKey, CompareKey } from '@/lib/periods';

type FiltersState = {
  period: PeriodKey;
  compare: CompareKey;
  setPeriod: (p: PeriodKey) => void;
  setCompare: (c: CompareKey) => void;
  setBoth: (p: PeriodKey, c: CompareKey) => void;
};

export const useFilters = create<FiltersState>((set) => ({
  period: 'last_30d',
  compare: 'previous_period',
  setPeriod: (period) => set({ period }),
  setCompare: (compare) => set({ compare }),
  setBoth: (period, compare) => set({ period, compare }),
}));
