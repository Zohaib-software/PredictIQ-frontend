import { addWeeks, getISOWeek, getISOWeekYear, setISOWeek, setISOWeekYear } from 'date-fns';

/**
 * Client-side linear trend projection (OLS on time index) for chart overlays.
 * Mirrors calendar-month stepping used by the backend forecast labels.
 */

const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Parse monthly bucket labels from {@link formatPeriodLabel} ("Apr 2025") or ISO-like "YYYY-MM".
 * @param {string} label
 * @returns {string|null} "YYYY-MM" or null
 */
export function parseMonthlyLabelToYm(label) {
  const s = String(label ?? '').trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const m = /^([A-Za-z]{3})\s+(\d{4})$/.exec(s);
  if (!m) return null;
  const idx = MONTH_NAMES_SHORT.findIndex((x) => x.toLowerCase() === m[1].toLowerCase());
  if (idx < 0) return null;
  return `${m[2]}-${String(idx + 1).padStart(2, '0')}`;
}

/** "2025-04" → "Apr 2025" (matches backend monthly labels). */
export function ymToMonthlyDisplayLabel(ym) {
  const parts = String(ym).split('-');
  const y = parseInt(parts[0], 10);
  const mo = parseInt(parts[1], 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return String(ym);
  return `${MONTH_NAMES_SHORT[mo - 1]} ${y}`;
}

function formatLocalYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * X-axis labels for projected points (Data page chart). Returns null if this grouping cannot be stepped.
 * @param {string} lastPeriod - Last bucket label from the API
 * @param {'daily'|'weekly'|'monthly'|'yearly'} periodType
 * @param {number} horizon - number of forward buckets (e.g. 1–3 days, weeks, months, or years)
 * @returns {string[]|null}
 */
export function getFuturePeriodLabels(lastPeriod, periodType, horizon) {
  if (horizon < 1) return [];
  const p = String(lastPeriod ?? '').trim();

  if (periodType === 'weekly') {
    const parsed = /^Week\s+(\d+)\s+(\d{4})$/i.exec(p);
    if (!parsed) return null;
    const week = Number(parsed[1]);
    const isoYear = Number(parsed[2]);
    const anchor = setISOWeek(setISOWeekYear(new Date(Date.UTC(isoYear, 5, 15)), isoYear), week);
    return Array.from({ length: horizon }, (_, j) => {
      const d = addWeeks(anchor, j + 1);
      return `Week ${getISOWeek(d)} ${getISOWeekYear(d)}`;
    });
  }

  if (periodType === 'monthly') {
    const ym0 = parseMonthlyLabelToYm(p);
    if (!ym0) return null;
    const useDisplay = !/^\d{4}-\d{2}$/.test(p);
    return Array.from({ length: horizon }, (_, j) => {
      const ym = addMonthsToPeriodLabel(ym0, j + 1);
      return useDisplay ? ymToMonthlyDisplayLabel(ym) : ym;
    });
  }

  if (periodType === 'daily') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p)) return null;
    const [Y, M, D] = p.split('-').map(Number);
    const d = new Date(Y, M - 1, D);
    if (Number.isNaN(d.getTime())) return null;
    return Array.from({ length: horizon }, (_, j) => {
      const x = new Date(d);
      x.setDate(x.getDate() + j + 1);
      return formatLocalYmd(x);
    });
  }

  if (periodType === 'yearly') {
    const y = parseInt(p, 10);
    if (!Number.isFinite(y) || String(y) !== p) return null;
    return Array.from({ length: horizon }, (_, j) => String(y + j + 1));
  }

  return null;
}

/**
 * @param {string} periodLabel - "YYYY-MM"
 * @param {number} monthsToAdd
 * @returns {string}
 */
export function addMonthsToPeriodLabel(periodLabel, monthsToAdd) {
  const parts = String(periodLabel).split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    throw new Error('Invalid period label');
  }
  let year = y;
  let month = m + monthsToAdd;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

function linearOls(xs, ys) {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return null;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const mx = sumX / n;
  const my = sumY / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    num += dx * (ys[i] - my);
    den += dx * dx;
  }
  if (den === 0) return null;
  const b = num / den;
  const a = my - b * mx;
  return { a, b };
}

/**
 * Predict next `horizon` values using OLS on x = 0..n-1, extrapolating to x = n..n+horizon-1.
 * @param {number[]} values
 * @param {number} horizon
 * @returns {number[]}
 */
export function projectForwardIndices(values, horizon) {
  const n = values.length;
  if (n < 2 || horizon < 1) return [];
  const xs = Array.from({ length: n }, (_, i) => i);
  const ys = values.map(Number);
  const fit = linearOls(xs, ys);
  if (!fit) return [];
  const out = [];
  for (let k = 0; k < horizon; k++) {
    const x = n + k;
    out.push(Math.round((fit.a + fit.b * x) * 100) / 100);
  }
  return out;
}

/**
 * Same as {@link projectForwardIndices} but without rounding each step; avoids stacked scatter
 * points when consecutive projected values would round to the same %.
 */
export function projectForwardIndicesExact(values, horizon) {
  const n = values.length;
  if (n < 2 || horizon < 1) return [];
  const xs = Array.from({ length: n }, (_, i) => i);
  const ys = values.map(Number);
  const fit = linearOls(xs, ys);
  if (!fit) return [];
  const out = [];
  for (let k = 0; k < horizon; k++) {
    out.push(fit.a + fit.b * (n + k));
  }
  return out;
}

/**
 * @param {string[]} periodLabels - ascending "YYYY-MM"
 * @param {number[]} values - same length
 * @param {number} horizon
 * @returns {{ periods: string[], values: number[] }}
 */
export function projectPeriodSeries(periodLabels, values, horizon) {
  if (!periodLabels?.length || periodLabels.length !== values.length || horizon < 1) {
    return { periods: [], values: [] };
  }
  const preds = projectForwardIndices(values, horizon);
  if (preds.length === 0) return { periods: [], values: [] };
  const lastLabel = periodLabels[periodLabels.length - 1];
  const periods = preds.map((_, i) => addMonthsToPeriodLabel(lastLabel, i + 1));
  return { periods, values: preds };
}
