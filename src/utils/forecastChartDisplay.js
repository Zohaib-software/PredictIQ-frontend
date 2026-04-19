import { parseMonthlyLabelToYm } from './seriesProjection';

function periodLabelToIsoMonthStart(periodLabel) {
  const ym = parseMonthlyLabelToYm(String(periodLabel ?? '').trim());
  return ym ? `${ym}-01` : null;
}

/**
 * Inclusive month filter for chart rows. `startDate` / `endDate` are HTML date values (YYYY-MM-DD).
 * Rows whose period cannot be parsed are excluded when any bound is set.
 */
export function filterForecastChartRowsByDateRange(rows, startDate, endDate) {
  if (!startDate && !endDate) return rows;
  if (!rows?.length) return rows;
  return rows.filter((row) => {
    const monthStart = periodLabelToIsoMonthStart(row.period);
    if (!monthStart) return false;
    if (startDate && monthStart < startDate) return false;
    if (endDate && monthStart > endDate) return false;
    return true;
  });
}
