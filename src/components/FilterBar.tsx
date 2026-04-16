'use client';

import { useState, useRef, useEffect } from 'react';
import { useDateRange } from '@/contexts/DateRangeContext';
import { DATE_PRESETS, COMPARISON_MODES, type PresetId, type ComparisonMode } from '@/lib/date-utils';

export default function FilterBar() {
  const { range, preset, comparisonMode, rangeLabel, comparisonLabel, setPreset, setCustomRange, setComparisonMode, triggerRefresh } = useDateRange();
  const [showPresets, setShowPresets] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState(range.start);
  const [customEnd, setCustomEnd] = useState(range.end);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const presetsRef = useRef<HTMLDivElement>(null);
  const compRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) setShowPresets(false);
      if (compRef.current && !compRef.current.contains(e.target as Node)) setShowComparison(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => { setCustomStart(range.start); setCustomEnd(range.end); }, [range.start, range.end]);

  const activePresetLabel = preset ? DATE_PRESETS.find(p => p.id === preset)?.label ?? rangeLabel : rangeLabel;
  const activeCompLabel = COMPARISON_MODES.find(m => m.id === comparisonMode)?.label ?? comparisonLabel;

  return (
    <div className="bg-card border border-border rounded-lg px-5 py-3.5 flex flex-wrap items-center gap-3 text-[12px] mb-4">
      {/* Period */}
      <div className="flex items-center gap-1.5" ref={presetsRef}>
        <span className="text-text-secondary font-medium">Okres:</span>
        <div className="relative">
          <button onClick={() => { setShowPresets(!showPresets); setShowComparison(false); }}
            className="bg-wire-bg border border-border rounded px-3 py-1.5 text-text font-medium hover:border-primary/40 cursor-pointer flex items-center gap-1">
            {activePresetLabel}
            <svg className="w-3 h-3 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 9l-7 7-7-7"/></svg>
          </button>
          {showPresets && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-50 min-w-[200px] py-1">
              {DATE_PRESETS.map(p => (
                <button key={p.id} onClick={() => { setPreset(p.id); setShowPresets(false); setShowCustom(false); }}
                  className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-primary-light cursor-pointer ${preset === p.id ? 'text-primary font-semibold bg-primary-light' : 'text-text'}`}>
                  {p.label}
                </button>
              ))}
              <div className="border-t border-border my-1" />
              <button onClick={() => setShowCustom(!showCustom)}
                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-primary-light cursor-pointer ${!preset ? 'text-primary font-semibold' : 'text-text'}`}>
                Własny zakres dat...
              </button>
              {showCustom && (
                <div className="px-3 py-2 border-t border-border flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-text-secondary w-8">Od:</label>
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                      className="flex-1 bg-wire-bg border border-border rounded px-2 py-1 text-[12px] text-text" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-text-secondary w-8">Do:</label>
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                      className="flex-1 bg-wire-bg border border-border rounded px-2 py-1 text-[12px] text-text" />
                  </div>
                  <button onClick={() => { if (customStart && customEnd && customStart <= customEnd) { setCustomRange(customStart, customEnd); setShowCustom(false); setShowPresets(false); } }}
                    disabled={!customStart || !customEnd || customStart > customEnd}
                    className="mt-1 bg-primary text-white text-[11px] font-medium rounded px-3 py-1.5 hover:bg-primary/90 disabled:opacity-40 cursor-pointer">
                    Zastosuj
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Comparison */}
      <div className="flex items-center gap-1.5" ref={compRef}>
        <span className="text-text-secondary font-medium">Porownanie:</span>
        <div className="relative">
          <button onClick={() => { setShowComparison(!showComparison); setShowPresets(false); }}
            className="bg-wire-bg border border-border rounded px-3 py-1.5 text-text font-medium hover:border-primary/40 cursor-pointer flex items-center gap-1">
            {activeCompLabel}
            <svg className="w-3 h-3 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 9l-7 7-7-7"/></svg>
          </button>
          {showComparison && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-50 min-w-[200px] py-1">
              {COMPARISON_MODES.map(m => (
                <button key={m.id} onClick={() => { setComparisonMode(m.id); setShowComparison(false); }}
                  className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-primary-light cursor-pointer ${comparisonMode === m.id ? 'text-primary font-semibold bg-primary-light' : 'text-text'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Refresh */}
      <button onClick={() => { setIsRefreshing(true); triggerRefresh(); setTimeout(() => setIsRefreshing(false), 1000); }}
        disabled={isRefreshing}
        className="flex items-center gap-1 bg-wire-bg border border-border rounded px-3 py-1.5 text-text-secondary font-medium hover:border-primary/40 hover:text-primary disabled:opacity-50 cursor-pointer">
        <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Odswiez
      </button>
    </div>
  );
}
