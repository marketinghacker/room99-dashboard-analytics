'use client';

import { useState } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import type { Alert, AlertSeverity } from '@/lib/alerts';

interface AlertBannerProps {
  alerts: Alert[];
  /** Max alerts to show before collapsing */
  maxVisible?: number;
}

const SEVERITY_CONFIG: Record<AlertSeverity, {
  icon: typeof AlertTriangle;
  bgClass: string;
  borderClass: string;
  textClass: string;
  badgeClass: string;
  label: string;
}> = {
  critical: {
    icon: AlertTriangle,
    bgClass: 'bg-red-bg',
    borderClass: 'border-red/20',
    textClass: 'text-red',
    badgeClass: 'bg-red text-white',
    label: 'Krytyczny',
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-yellow-bg',
    borderClass: 'border-yellow/20',
    textClass: 'text-yellow',
    badgeClass: 'bg-yellow text-white',
    label: 'Ostrzeżenie',
  },
  info: {
    icon: AlertTriangle,
    bgClass: 'bg-primary-light',
    borderClass: 'border-primary/20',
    textClass: 'text-primary',
    badgeClass: 'bg-primary text-white',
    label: 'Info',
  },
};

function AlertItem({ alert }: { alert: Alert }) {
  const config = SEVERITY_CONFIG[alert.severity];
  const DirectionIcon = alert.direction === 'down' ? TrendingDown : TrendingUp;

  return (
    <div className={`flex items-start gap-3 px-4 py-2.5 ${config.bgClass} rounded-lg ${config.borderClass} border`}>
      <DirectionIcon className={`h-4 w-4 ${config.textClass} shrink-0 mt-0.5`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${config.badgeClass}`}>
            {config.label}
          </span>
          <span className="text-[12px] font-medium text-text">{alert.label}</span>
        </div>
        <p className="text-[11px] text-text-secondary mt-0.5">
          {alert.message}
        </p>
      </div>

      <span className={`text-[13px] font-bold ${config.textClass} shrink-0`}>
        {alert.changePercent > 0 ? '+' : ''}{alert.changePercent.toFixed(1)}%
      </span>
    </div>
  );
}

export default function AlertBanner({ alerts, maxVisible = 3 }: AlertBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (!alerts || alerts.length === 0) return null;

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;
  const visibleAlerts = expanded ? alerts : alerts.slice(0, maxVisible);
  const hasMore = alerts.length > maxVisible;

  return (
    <div className="space-y-2">
      {/* Summary header */}
      <div className="flex items-center gap-2 text-[12px]">
        <AlertTriangle className="h-4 w-4 text-yellow" />
        <span className="font-semibold text-text">Alerty trendów</span>
        {criticalCount > 0 && (
          <span className="bg-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {criticalCount} krytyczny{criticalCount > 1 ? 'e' : ''}
          </span>
        )}
        {warningCount > 0 && (
          <span className="bg-yellow text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {warningCount} ostrzeżeni{warningCount > 1 ? 'a' : 'e'}
          </span>
        )}
      </div>

      {/* Alert items */}
      <div className="space-y-1.5">
        {visibleAlerts.map((alert, i) => (
          <AlertItem key={`${alert.metric}-${i}`} alert={alert} />
        ))}
      </div>

      {/* Expand/collapse */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[11px] text-primary font-medium hover:text-primary/80 transition-colors cursor-pointer"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Pokaż mniej
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Pokaż wszystkie ({alerts.length})
            </>
          )}
        </button>
      )}
    </div>
  );
}
