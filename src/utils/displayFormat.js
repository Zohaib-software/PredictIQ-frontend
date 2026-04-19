/**
 * Display number formatting — en-GB locale for GBP, thousands separators, and readable stats.
 * Use these helpers site-wide so figures stay consistent (avoid raw toFixed / mixed locales).
 */

const LOCALE = 'en-GB';

// --- GBP: currency ---

/**
 * Chart Y-axis — compact £ labels (e.g. £3.5M, £350K). Short ticks; pair tooltips with formatGbp / formatGbpFull.
 */
export function formatChartAxisGBP(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';

  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'GBP',
    notation: 'compact',
    compactDisplay: 'short',
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(n) < 1000 ? 0 : 1,
  }).format(n);
}

/** Funnel / small KPI tiles — compact £. */
export function formatFunnelGbp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'GBP',
    notation: 'compact',
    compactDisplay: 'short',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Headline figures where full GBP strings are too long — e.g. £8.23bn, £592m (en-GB compact).
 * Hover tooltips should use {@link formatGbpFull} for the exact amount.
 */
export const formatGbpCompact = formatFunnelGbp;

/** Full GBP with two decimal places (reconciliation, title/tooltip “exact” amounts). */
export function formatGbpFull(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Default GBP for tables, KPIs, chart tooltips — proper £ and grouping; up to 2 dp, no trailing noise.
 */
export function formatGbp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

// --- Percentages (stored as “points”: 12.5 => 12.5%) ---

export function formatPercentPoints(value, fractionDigits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n) + '%';
}

// --- Plain decimals (correlations, elasticity, model metrics) ---

export function formatDecimal(value, fractionDigits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

/** Counts and integers with grouping (e.g. histogram frequency). */
export function formatInteger(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(LOCALE, {
    maximumFractionDigits: 0,
  }).format(n);
}
