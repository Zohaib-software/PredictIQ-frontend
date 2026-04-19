/**
 * Sentinel stored on anomaly_detected.periodLabel when one notification covers all open months.
 * Must match PredictIQ-backend/services/alertService.js EXPENSE_ANOMALY_NOTIFICATION_PERIOD_KEY.
 */
export const EXPENSE_ANOMALY_AGGREGATE_PERIOD = '__anomaly_open__';

/** Whether this row should show the expense anomaly chart CTA. */
export function showExpenseAnomalyChartCta(n) {
  if (n?.type !== 'anomaly_detected') return false;
  const opens = n.openPeriodLabels;
  if (Array.isArray(opens) && opens.some((p) => String(p || '').trim())) return true;
  const pl = String(n.periodLabel || '').trim();
  if (!pl) return false;
  if (pl === EXPENSE_ANOMALY_AGGREGATE_PERIOD) return false;
  return true;
}

/** YYYY-MM to pass as highlight= (earliest open month when combined). */
export function expenseAnomalyHighlightFromNotification(n) {
  if (n?.type !== 'anomaly_detected') return null;
  const opens = Array.isArray(n.openPeriodLabels)
    ? n.openPeriodLabels.map((p) => String(p || '').trim()).filter(Boolean)
    : [];
  if (opens.length) return [...opens].sort()[0];
  const pl = String(n.periodLabel || '').trim();
  if (pl && pl !== EXPENSE_ANOMALY_AGGREGATE_PERIOD) return pl;
  return null;
}

/** Secondary line under the message (periods to review). */
export function expenseAnomalyPeriodHint(n) {
  if (n?.type !== 'anomaly_detected') return null;
  const opens = Array.isArray(n.openPeriodLabels)
    ? n.openPeriodLabels.map((p) => String(p || '').trim()).filter(Boolean)
    : [];
  if (opens.length === 0) return null;
  const sorted = [...opens].sort();
  if (sorted.length === 1) return `Chart period: ${sorted[0]}`;
  return `Open months: ${sorted.join(', ')}`;
}
