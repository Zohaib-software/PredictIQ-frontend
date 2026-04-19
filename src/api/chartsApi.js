import { fetchWithAuth } from './fetchWithAuth.js';
import origin from './apiOrigin.js';

const API_BASE = `${origin}/api/charts`;

async function fetchChart(endpoint) {
  const res = await fetchWithAuth(`${API_BASE}${endpoint}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || 'Failed to load chart data');
  return json.data;
}

function createChartFetcher(endpoint) {
  const fetcher = () => fetchChart(endpoint);
  fetcher.cacheKey = `${API_BASE}${endpoint}`;
  return fetcher;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Costs summary with optional cost-breakdown date filter (matches Reports date pickers).
 * Cache key includes query string so range changes refetch.
 */
export function createCostsSummaryFetcher(breakdownStartDate, breakdownEndDate) {
  const qs = new URLSearchParams();
  const s = breakdownStartDate != null ? String(breakdownStartDate).trim() : '';
  const e = breakdownEndDate != null ? String(breakdownEndDate).trim() : '';
  if (s && ISO_DATE.test(s)) qs.set('breakdownStartDate', s);
  if (e && ISO_DATE.test(e)) qs.set('breakdownEndDate', e);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const fetcher = () => fetchChart(`/costs-summary${suffix}`);
  fetcher.cacheKey = `${API_BASE}/costs-summary${suffix}`;
  return fetcher;
}

export const chartsApi = {
  adSpendRevenue: createChartFetcher('/ad-spend-revenue'),
  adSpendRoi: createChartFetcher('/ad-spend-roi'),
  expenseVolatilityGauge: createChartFetcher('/expense-volatility-gauge'),
  expenseRevenueElasticity: createChartFetcher('/expense-revenue-elasticity'),
  roiDistributionHistogram: createChartFetcher('/roi-distribution-histogram'),
  correlationHeatmap: createChartFetcher('/correlation-heatmap'),
  costsSummary: createChartFetcher('/costs-summary'),
};
