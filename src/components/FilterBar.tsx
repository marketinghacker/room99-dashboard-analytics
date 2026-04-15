'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, RefreshCw, GitCompareArrows } from 'lucide-react';
import { useDateRange } from '@/contexts/DateRangeContext';
import { DATE_PRESETS, COMPARISON_MODES, type PresetId, type ComparisonMode } from '@/lib/date-utils';

export default function FilterBar() {
  const {
    range,
    preset,
    comparisonMode,
    rangeLabel,
    comparisonLabel,
    setPreset,
    setCustomRange,
    setComparisonMode,
    triggerRefresh,
  } = useDateRange();

  const [showPresets, setShowPresets] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState(range.start);
  const [customEnd, setCustomEnd] = useState(range.end);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const presetsRef = useRef<HTMLDivElement>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
        setShowPresets(false);
      }
      if (comparisonRef.current && !comparisonRef.current.contains(e.target as Node)) {
        setShowComparison(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Sync custom inputs when range changes externally
  useEffect(() => {
    setCustomStart(range.start);
    setCustomEnd(range.end);
  }, [range.start, range.end]);

  const handlePresetSelect = (presetId: PresetId) => {
    setPreset(presetId);
    setShowPresets(false);
    setShowCustom(false);
  };

  const handleCustomApply = () => {
    if (customStart && customEnd && customStart <= customEnd) {
      setCustomRange(customStart, customEnd);
      setShowCustom(false);
      setShowPresets(false);
    }
  };

  const handleComparisonSelect = (mode: ComparisonMode) => {
    setComparisonMode(mode);
    setShowComparison(false);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    triggerRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const activePresetLabel = preset
    ? DATE_PRESETS.find((p) => p.id === preset)?.label ?? rangeLabel
    : rangeLabel;

  const activeComparisonLabel = COMPARISON_MODES.find(
    (m) => m.id === comparisonMode
  )?.label ?? comparisonLabel;

  return (
    <div className="glass-card px-5 py-3 flex flex-wrap items-center gap-3 text-[12px]" style={{ boxShadow: 'var(--shadow-sm)' }}>
      {/* ── Period selector ── */}
      <div className="flex items-center gap-2" ref={presetsRef}>
        <Calendar className="h-3.5 w-3.5 text-text-secondary" />
        <span className="text-text-secondary font-medium">Okres:</span>

        <div className="relative">
          <button
            onClick={() => { setShowPresets(!showPresets); setShowComparison(false); }}
            className="flex items-center gap-1.5 bg-surface rounded-lg px-3 py-1.5 text-text-secondary font-medium hover:bg-surface-hover hover:text-text transition-colors cursor-pointer"
          >
            <span>{activePresetLabel}</span>
            <ChevronDown className="h-3 w-3 text-text-secondary" />
          </button>

          {showPresets && (
            <div className="absolute top-full left-0 mt-1 glass-card shadow-lg z-50 min-w-[220px] py-1">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePresetSelect(p.id)}
                  className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-surface-hover transition-colors cursor-pointer ${
                    preset === p.id ? 'text-accent font-semibold bg-accent-glow' : 'text-text'
                  }`}
                >
                  {p.label}
                </button>
              ))}

              {/* Divider */}
              <div className="border-t border-glass-border my-1" />

              {/* Custom range toggle */}
              <button
                onClick={() => setShowCustom(!showCustom)}
                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-surface-hover transition-colors cursor-pointer ${
                  !preset ? 'text-primary font-semibold' : 'text-text'
                }`}
              >
                Własny zakres dat...
              </button>

              {showCustom && (
                <div className="px-3 py-2 border-t border-glass-border flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-text-secondary w-8">Od:</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="flex-1 bg-surface border border-glass-border rounded-lg px-2.5 py-1.5 text-[12px] text-text"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-text-secondary w-8">Do:</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="flex-1 bg-surface border border-glass-border rounded-lg px-2.5 py-1.5 text-[12px] text-text"
                    />
                  </div>
                  <button
                    onClick={handleCustomApply}
                    disabled={!customStart || !customEnd || customStart > customEnd}
                    className="mt-1 bg-accent text-black font-bold text-[11px] font-medium rounded px-3 py-1.5 hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Zastosuj
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-glass-border" />

      {/* ── Comparison selector ── */}
      <div className="flex items-center gap-2" ref={comparisonRef}>
        <GitCompareArrows className="h-3.5 w-3.5 text-text-secondary" />
        <span className="text-text-secondary font-medium">Porównanie:</span>

        <div className="relative">
          <button
            onClick={() => { setShowComparison(!showComparison); setShowPresets(false); }}
            className="flex items-center gap-1.5 bg-surface rounded-lg px-3 py-1.5 text-text-secondary font-medium hover:bg-surface-hover hover:text-text transition-colors cursor-pointer"
          >
            <span>{activeComparisonLabel}</span>
            <ChevronDown className="h-3 w-3 text-text-secondary" />
          </button>

          {showComparison && (
            <div className="absolute top-full left-0 mt-1 glass-card shadow-lg z-50 min-w-[200px] py-1">
              {COMPARISON_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleComparisonSelect(m.id)}
                  className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-surface-hover transition-colors cursor-pointer ${
                    comparisonMode === m.id ? 'text-accent font-semibold bg-accent-glow' : 'text-text'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Comparison label (subtle) */}
        <span className="text-[11px] text-text-secondary hidden sm:inline">
          {comparisonLabel}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-glass-border" />

      {/* ── Refresh button ── */}
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-1.5 bg-wire-bg border border-border rounded px-2.5 py-1 text-text-muted font-medium hover:bg-surface-hover hover:text-text transition-colors disabled:opacity-50 cursor-pointer"
        title="Odśwież dane"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">Odśwież</span>
      </button>
    </div>
  );
}
