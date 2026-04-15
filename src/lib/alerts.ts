/**
 * Threshold-based alert detection for dashboard metrics.
 * Compares current vs previous period and flags significant changes.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertDirection = 'up' | 'down';

export interface Alert {
  metric: string;
  label: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  direction: AlertDirection;
  severity: AlertSeverity;
  message: string;
}

export interface MetricThreshold {
  metric: string;
  label: string;
  /** % change that triggers a warning (absolute value) */
  warningThreshold: number;
  /** % change that triggers a critical alert (absolute value) */
  criticalThreshold: number;
  /** Is a decline bad? (true for revenue, false for costs) */
  declineIsBad: boolean;
}

/* ------------------------------------------------------------------ */
/*  Default thresholds                                                  */
/* ------------------------------------------------------------------ */

export const DEFAULT_THRESHOLDS: MetricThreshold[] = [
  { metric: 'revenue', label: 'Przychód', warningThreshold: 10, criticalThreshold: 20, declineIsBad: true },
  { metric: 'sessions', label: 'Sesje', warningThreshold: 15, criticalThreshold: 30, declineIsBad: true },
  { metric: 'transactions', label: 'Transakcje', warningThreshold: 10, criticalThreshold: 25, declineIsBad: true },
  { metric: 'cr', label: 'Współczynnik konwersji', warningThreshold: 15, criticalThreshold: 30, declineIsBad: true },
  { metric: 'aov', label: 'Średnia wartość zamówienia', warningThreshold: 10, criticalThreshold: 20, declineIsBad: true },
  { metric: 'roas', label: 'ROAS', warningThreshold: 20, criticalThreshold: 35, declineIsBad: true },
  { metric: 'totalSpend', label: 'Wydatki marketingowe', warningThreshold: 25, criticalThreshold: 40, declineIsBad: false },
  { metric: 'costShare', label: 'Udział kosztów', warningThreshold: 15, criticalThreshold: 25, declineIsBad: false },
];

/* ------------------------------------------------------------------ */
/*  Detection                                                          */
/* ------------------------------------------------------------------ */

/**
 * Calculate % change between two values.
 * Returns 0 if previous value is 0 (avoid division by zero).
 */
function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Detect alerts by comparing current metrics with previous period metrics.
 *
 * @param current - Object with metric keys and current values
 * @param previous - Object with metric keys and previous period values
 * @param thresholds - Alert thresholds (defaults to DEFAULT_THRESHOLDS)
 * @returns Array of alerts, sorted by severity (critical first)
 */
export function detectAlerts(
  current: Record<string, number>,
  previous: Record<string, number>,
  thresholds: MetricThreshold[] = DEFAULT_THRESHOLDS
): Alert[] {
  const alerts: Alert[] = [];

  for (const threshold of thresholds) {
    const currentValue = current[threshold.metric];
    const previousValue = previous[threshold.metric];

    if (currentValue === undefined || previousValue === undefined) continue;

    const changePercent = calcChange(currentValue, previousValue);
    const absChange = Math.abs(changePercent);
    const direction: AlertDirection = changePercent >= 0 ? 'up' : 'down';

    // Determine if this change is concerning
    const isBadChange = threshold.declineIsBad
      ? direction === 'down'  // Revenue declining = bad
      : direction === 'up';   // Costs increasing = bad

    if (!isBadChange) continue; // Positive change, no alert needed

    let severity: AlertSeverity | null = null;
    if (absChange >= threshold.criticalThreshold) {
      severity = 'critical';
    } else if (absChange >= threshold.warningThreshold) {
      severity = 'warning';
    }

    if (!severity) continue;

    const directionText = direction === 'up' ? 'wzrost' : 'spadek';
    const message = `${threshold.label}: ${directionText} o ${absChange.toFixed(1)}% (${previousValue.toLocaleString('pl-PL')} → ${currentValue.toLocaleString('pl-PL')})`;

    alerts.push({
      metric: threshold.metric,
      label: threshold.label,
      currentValue,
      previousValue,
      changePercent,
      direction,
      severity,
      message,
    });
  }

  // Sort: critical first, then warning
  return alerts.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}
