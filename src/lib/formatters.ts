/**
 * Polish locale number formatters for the Room99 dashboard.
 * Uses non-breaking space as thousands separator and comma as decimal separator.
 */

/**
 * Format a number as Polish PLN currency.
 * Integers: "1 850 000 PLN"
 * Floats < 100: "21,37 PLN" (2 decimals)
 */
export function formatPLN(value: number): string {
  const isFloat = value % 1 !== 0 && Math.abs(value) < 100;
  const decimals = isFloat ? 2 : 0;
  const formatted = new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return `${formatted} PLN`;
}

/**
 * Format a number with Polish space separator.
 * "250 000"
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a number as a percentage with comma decimal.
 * "2,15%"
 */
export function formatPercent(value: number): string {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + '%';
}

/**
 * Format a decimal number with comma separator.
 * "21,6"
 */
export function formatDecimal(value: number, decimals: number = 1): string {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a change value as a directional indicator.
 * Returns text with arrow and direction.
 */
export function formatChange(value: number): {
  text: string;
  direction: 'up' | 'down' | 'neutral';
} {
  if (value > 0) {
    return {
      text: `\u2191 ${formatDecimal(Math.abs(value), 1)}%`,
      direction: 'up',
    };
  }
  if (value < 0) {
    return {
      text: `\u2193 ${formatDecimal(Math.abs(value), 1)}%`,
      direction: 'down',
    };
  }
  return {
    text: `\u2192 0%`,
    direction: 'neutral',
  };
}
