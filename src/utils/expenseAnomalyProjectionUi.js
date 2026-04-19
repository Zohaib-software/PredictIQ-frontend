import { parseMonthlyLabelToYm } from './seriesProjection';

function projectedMonthIsoFromLast(lastPeriodLabel, monthsAhead) {
  const ym = parseMonthlyLabelToYm(String(lastPeriodLabel ?? '').trim());
  if (!ym) return null;
  const [y0, m0] = ym.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y0) || !Number.isFinite(m0)) return null;
  let y = y0;
  let m = m0 + monthsAhead;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

/**
 * Whether any forward month from the last visible period would fall inside the filter
 * (inclusive month bounds using HTML date values). When no filter, projection UI is allowed.
 * Only reads `data.date` — works for expense anomaly, profit margin, etc.
 */
export function expenseAnomalyProjectionVisibleInDateRange(
  anomalyDisplayData,
  startDate,
  endDate,
  projectionMonths
) {
  if (!anomalyDisplayData?.date?.length) return false;
  if (!startDate && !endDate) return true;
  const lastLabel = anomalyDisplayData.date[anomalyDisplayData.date.length - 1];
  const n = Math.max(1, projectionMonths ?? 1);
  for (let j = 1; j <= n; j += 1) {
    const ms = projectedMonthIsoFromLast(lastLabel, j);
    if (!ms) continue;
    if (startDate && ms < startDate) continue;
    if (endDate && ms > endDate) continue;
    return true;
  }
  return false;
}
