import { fetchWithAuth } from './fetchWithAuth.js';
import origin from './apiOrigin.js';

const API_BASE = `${origin}/api/forecast`;

/**
 * @param {string} pathWithQuery - e.g. "/cashflow?horizon=6&period=monthly"
 * @returns {Promise<{
 *   shortTermForecasts: {
 *     day30: { predictedCashFlow?: number },
 *     day60: { predictedCashFlow?: number },
 *     day90: { predictedCashFlow?: number },
 *   },
 *   predictions?: { periodLabel: string, predictedCashFlow: number }[],
 *   accuracyMetrics: { MAE: number, RMSE: number, MAPE: number | null },
 * }>}
 */
async function fetchForecast(pathWithQuery) {
  const res = await fetchWithAuth(`${API_BASE}${pathWithQuery}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || 'Failed to load forecast');
  return json.data;
}

export const forecastApi = {
  /**
   * Monthly cash-flow forecast (future periods only).
   * @param {{ horizon?: number, period?: 'monthly' }} [opts]
   */
  cashFlow: (opts = {}) => {
    const horizon = opts.horizon ?? 6;
    const period = opts.period ?? 'monthly';
    const params = new URLSearchParams({
      horizon: String(horizon),
      period,
    });
    return fetchForecast(`/cashflow?${params.toString()}`);
  },
};
