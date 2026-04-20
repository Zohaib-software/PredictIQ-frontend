import { addMonthsToPeriodLabel, parseMonthlyLabelToYm } from './seriesProjection';

/** Same key as Data/Overview projection control (monthly = N future months). */
export const STORAGE_DATA_PROJECTION_STEPS_KEY = 'predictiq_data_chart_projection_horizon_steps';

/** Viewports this wide or narrower get a one-time default ~12-month chart range (incl. projection tail). */
export const SMALL_SCREEN_DEFAULT_CHART_MAX_PX = 768;

export function readMonthlyProjectionHorizonSteps() {
  if (typeof window === 'undefined') return 1;
  try {
    const n = Number.parseInt(window.localStorage.getItem(STORAGE_DATA_PROJECTION_STEPS_KEY), 10);
    return [1, 2, 3].includes(n) ? n : 1;
  } catch {
    return 1;
  }
}

/** @param {string} ym - "YYYY-MM" */
export function ymToEndOfMonthDate(ym) {
  const parts = String(ym).split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return `${ym}-28`;
  }
  const lastDay = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export function matchesSmallScreenForDefaultChartDates() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(max-width: ${SMALL_SCREEN_DEFAULT_CHART_MAX_PX}px)`).matches;
}

/**
 * @param {{ period: string }[]} records - Chronological monthly records (oldest first).
 * @returns {{ startDate: string, endDate: string } | null} ISO date strings for FilterBar (start = month start, end = last day of month).
 */
export function computeSmallScreenDefaultIsoDatesFromMonthlyRecords(records) {
  if (!Array.isArray(records) || records.length === 0) return null;

  const lastYm = parseMonthlyLabelToYm(records[records.length - 1]?.period);
  const firstYm = parseMonthlyLabelToYm(records[0]?.period);
  if (!lastYm) return null;

  const projSteps = records.length >= 2 ? readMonthlyProjectionHorizonSteps() : 0;
  let endYm = lastYm;
  if (projSteps > 0) {
    try {
      endYm = addMonthsToPeriodLabel(lastYm, projSteps);
    } catch {
      endYm = lastYm;
    }
  }

  let startYm = addMonthsToPeriodLabel(endYm, -11);
  if (firstYm && startYm.localeCompare(firstYm) < 0) {
    startYm = firstYm;
  }

  return { startDate: `${startYm}-01`, endDate: ymToEndOfMonthDate(endYm) };
}
