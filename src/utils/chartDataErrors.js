/**
 * When true, treat the failed request like "no chart data" (show upload hint), not a red error.
 * Covers forecast insufficient history (400) and similar chart API responses.
 */
export function isMissingFinancialDataApiError(err) {
  const status = Number(err?.status);
  const msg = String(err?.message ?? '').toLowerCase();
  if (!Number.isFinite(status) || status < 400) return false;

  if (status === 400) {
    return /insufficient\s+history|need at least\s+\d+\s+monthly|no records|no financial|empty\s+series|could not fit trend|only period/i.test(
      msg
    );
  }

  if (status === 404) {
    return /no (financial )?data|not found|no records/i.test(msg);
  }

  return false;
}
