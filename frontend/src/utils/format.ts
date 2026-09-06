import { CURRENCY } from '../constants/config';

/**
 * Indian digit grouping (1,00,000) via Intl, with a manual fallback because some older
 * Android JSC builds ship without full ICU data.
 */
export function formatMoney(value: number | null | undefined, withSymbol = true): string {
  const amount = Number.isFinite(value) ? Number(value) : 0;
  const negative = amount < 0;
  const absolute = Math.abs(amount);

  let formatted: string;
  try {
    formatted = new Intl.NumberFormat(CURRENCY.locale, {
      maximumFractionDigits: absolute % 1 === 0 ? 0 : 2,
      minimumFractionDigits: absolute % 1 === 0 ? 0 : 2,
    }).format(absolute);
  } catch {
    formatted = groupIndian(absolute);
  }

  return `${negative ? '-' : ''}${withSymbol ? CURRENCY.symbol : ''}${formatted}`;
}

function groupIndian(value: number): string {
  const [whole, decimals] = value.toFixed(value % 1 === 0 ? 0 : 2).split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return decimals ? `${grouped}.${decimals}` : grouped;
}

/** Short form for chart axes: 45000 becomes 45K, 1250000 becomes 12.5L. */
export function formatCompact(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
  if (absolute >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (absolute >= 1000) return `${Math.round(value / 1000)}K`;
  return String(Math.round(value));
}

export function formatPercent(value: number | null | undefined, decimals = 0): string {
  const percent = Number.isFinite(value) ? Number(value) : 0;
  return `${percent.toFixed(decimals)}%`;
}
