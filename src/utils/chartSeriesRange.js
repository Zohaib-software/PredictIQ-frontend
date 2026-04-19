import { addMonthsToPeriodLabel, parseMonthlyLabelToYm, projectForwardIndices } from './seriesProjection';

/** Last N calendar periods (monthly rows), assuming API returns ascending order. */

export function sliceRevenueExpensesData(data, lastPeriods) {
  if (!data?.labels?.length) return data;
  if (lastPeriods == null) return data;
  const n = data.labels.length;
  const start = Math.max(0, n - lastPeriods);
  return {
    labels: data.labels.slice(start),
    revenue: data.revenue?.slice(start) ?? [],
    expenses: data.expenses?.slice(start) ?? [],
  };
}

export function sliceCostPerSaleData(data, lastPeriods) {
  if (!data?.periodLabels?.length) return data;
  if (lastPeriods == null) return data;
  const n = data.periodLabels.length;
  const start = Math.max(0, n - lastPeriods);
  return {
    periodLabels: data.periodLabels.slice(start),
    values: data.values?.slice(start) ?? [],
  };
}

export function sliceNetProfitData(data, lastPeriods) {
  if (!data?.date?.length) return data;
  if (lastPeriods == null) return data;
  const n = data.date.length;
  const start = Math.max(0, n - lastPeriods);
  return {
    date: data.date.slice(start),
    total_revenue: data.total_revenue?.slice(start) ?? [],
    total_expenses: data.total_expenses?.slice(start) ?? [],
    netProfit: data.netProfit?.slice(start) ?? [],
  };
}

/** Pearson r for aligned numeric arrays (length >= 2). */
export function pearsonCorrelation(xs, ys) {
  const n = Math.min(xs?.length ?? 0, ys?.length ?? 0);
  if (n < 2) return null;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const mx = sumX / n;
  const my = sumY / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const vx = xs[i] - mx;
    const vy = ys[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  const den = Math.sqrt(dx * dy);
  if (den === 0) return null;
  return num / den;
}

/** OLS y ~ intercept + slope * x (matches backend jStat.models.ols with rows [1, x]). */
export function olsSlopeIntercept(xs, ys) {
  const n = Math.min(xs?.length ?? 0, ys?.length ?? 0);
  if (n < 2) return null;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += Number(xs[i]);
    my += Number(ys[i]);
  }
  mx /= n;
  my /= n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = Number(xs[i]) - mx;
    num += dx * (Number(ys[i]) - my);
    den += dx * dx;
  }
  if (den === 0) return null;
  const slope = num / den;
  const intercept = my - slope * mx;
  return {
    slope: Math.round(slope * 10000) / 10000,
    intercept: Math.round(intercept * 100) / 100,
  };
}

/**
 * OLS Δ revenue ~ intercept + slope × Δ expenses (same as backend expense-revenue-elasticity).
 * Intercept and reported elasticity use 3 decimal places; slope is full precision for the line.
 */
export function computeElasticityRegression(deltaExpenses, deltaRevenue) {
  const xs = (deltaExpenses ?? []).map(Number);
  const ys = (deltaRevenue ?? []).map(Number);
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    num += dx * (ys[i] - my);
    den += dx * dx;
  }
  if (den === 0) return null;
  const slope = num / den;
  const intercept = my - slope * mx;
  return {
    slope,
    intercept: Math.round(intercept * 1000) / 1000,
    elasticity: Math.round(slope * 1000) / 1000,
  };
}

export function sliceAdSpendRevenueData(data, lastPeriods) {
  if (!data?.date?.length) return data;
  if (lastPeriods == null) return data;
  const n = data.date.length;
  const start = Math.max(0, n - lastPeriods);
  return {
    date: data.date.slice(start),
    ad_spend: data.ad_spend?.slice(start) ?? [],
    total_revenue: data.total_revenue?.slice(start) ?? [],
  };
}

/**
 * Full-series rows for ad spend vs revenue chart: actuals plus optional forward projection
 * from the last historical month (same anchor as the overview revenue chart).
 * @param {{ date: string[], ad_spend?: number[], total_revenue?: number[] }} data
 * @param {number} projectionMonths
 * @param {boolean} includeProjection
 * @returns {Array<{ period: string, ad_spend: number|null, total_revenue: number|null, adProj: number|null, revProj: number|null }>}
 */
export function buildAdSpendRevenueMergedChartRows(data, projectionMonths, includeProjection) {
  if (!data?.date?.length) return [];
  const baseRows = data.date.map((d, i) => ({
    period: d,
    ad_spend: data.ad_spend?.[i] ?? 0,
    total_revenue: data.total_revenue?.[i] ?? 0,
    adProj: null,
    revProj: null,
  }));
  if (!includeProjection || baseRows.length < 2) return baseRows;

  const ha = projectForwardIndices(
    data.date.map((_, i) => data.ad_spend?.[i] ?? 0),
    projectionMonths
  );
  const hr = projectForwardIndices(
    data.date.map((_, i) => data.total_revenue?.[i] ?? 0),
    projectionMonths
  );
  if (ha.length === 0) return baseRows;

  const lastLabel = data.date[data.date.length - 1];
  const bridged = baseRows.map((row, i) =>
    i === baseRows.length - 1
      ? { ...row, adProj: row.ad_spend, revProj: row.total_revenue }
      : row
  );
  const future = ha.map((av, j) => ({
    period: addMonthsToPeriodLabel(lastLabel, j + 1),
    ad_spend: null,
    total_revenue: null,
    adProj: av,
    revProj: hr[j],
  }));
  return [...bridged, ...future];
}

export function sliceProfitMarginData(data, lastPeriods) {
  if (!data?.date?.length) return data;
  if (lastPeriods == null) return data;
  const n = data.date.length;
  const start = Math.max(0, n - lastPeriods);
  return {
    date: data.date.slice(start),
    profit_margin: data.profit_margin?.slice(start) ?? [],
    total_revenue: data.total_revenue?.slice(start) ?? [],
    gross_profit: data.gross_profit?.slice(start) ?? [],
  };
}

export function sliceExpenseAnomalyData(data, lastPeriods) {
  if (!data?.date?.length) return data;
  if (lastPeriods == null) return data;
  const n = data.date.length;
  const start = Math.max(0, n - lastPeriods);
  return {
    date: data.date.slice(start),
    total_expenses: data.total_expenses?.slice(start) ?? [],
    trend: data.trend?.slice(start) ?? [],
    trend_upper: data.trend_upper?.slice(start) ?? [],
    trend_lower: data.trend_lower?.slice(start) ?? [],
    ad_spend: data.ad_spend?.slice(start) ?? [],
    outliers: data.outliers?.slice(start) ?? [],
    upperBand: data.upperBand?.slice(start) ?? [],
    lowerBand: data.lowerBand?.slice(start) ?? [],
    isAnomaly: data.isAnomaly?.slice(start) ?? [],
    notes: data.notes?.slice(start) ?? [],
    recordId: data.recordId?.slice(start) ?? [],
  };
}

function expenseAnomalyPeriodToIsoMonthStart(periodLabel) {
  const ym = parseMonthlyLabelToYm(String(periodLabel ?? '').trim());
  return ym ? `${ym}-01` : null;
}

/**
 * Keeps rows whose month (from period label) falls within inclusive ISO date bounds.
 * `startDate` / `endDate` are HTML date input values (YYYY-MM-DD), compared to YYYY-MM-01.
 */
export function filterExpenseAnomalyByDateRange(data, startDate, endDate) {
  if (!data?.date?.length) return data;
  if (!startDate && !endDate) return data;
  const indices = [];
  for (let i = 0; i < data.date.length; i += 1) {
    const monthStart = expenseAnomalyPeriodToIsoMonthStart(data.date[i]);
    if (!monthStart) continue;
    if (startDate && monthStart < startDate) continue;
    if (endDate && monthStart > endDate) continue;
    indices.push(i);
  }
  const pick = (arr) => (Array.isArray(arr) ? indices.map((j) => arr[j]) : []);
  if (indices.length === 0) {
    return {
      date: [],
      total_expenses: [],
      trend: [],
      trend_upper: [],
      trend_lower: [],
      ad_spend: [],
      outliers: [],
      upperBand: [],
      lowerBand: [],
      isAnomaly: [],
      notes: [],
      recordId: [],
    };
  }
  return {
    date: pick(data.date),
    total_expenses: pick(data.total_expenses ?? []),
    trend: pick(data.trend ?? []),
    trend_upper: pick(data.trend_upper ?? []),
    trend_lower: pick(data.trend_lower ?? []),
    ad_spend: pick(data.ad_spend ?? []),
    outliers: pick(data.outliers ?? []),
    upperBand: pick(data.upperBand ?? []),
    lowerBand: pick(data.lowerBand ?? []),
    isAnomaly: pick(data.isAnomaly ?? []),
    notes: pick(data.notes ?? []),
    recordId: pick(data.recordId ?? []),
  };
}

/**
 * Same month bounds as {@link filterExpenseAnomalyByDateRange} for profit margin series.
 */
export function filterProfitMarginByDateRange(data, startDate, endDate) {
  if (!data?.date?.length) return data;
  if (!startDate && !endDate) return data;
  const indices = [];
  for (let i = 0; i < data.date.length; i += 1) {
    const monthStart = expenseAnomalyPeriodToIsoMonthStart(data.date[i]);
    if (!monthStart) continue;
    if (startDate && monthStart < startDate) continue;
    if (endDate && monthStart > endDate) continue;
    indices.push(i);
  }
  const pick = (arr) => (Array.isArray(arr) ? indices.map((j) => arr[j]) : []);
  if (indices.length === 0) {
    return {
      date: [],
      profit_margin: [],
      total_revenue: [],
      gross_profit: [],
    };
  }
  return {
    date: pick(data.date),
    profit_margin: pick(data.profit_margin ?? []),
    total_revenue: pick(data.total_revenue ?? []),
    gross_profit: pick(data.gross_profit ?? []),
  };
}

/**
 * Sums monthly profit-margin and expense-anomaly rows (already filtered to the same months) into
 * the same shape as GET /efficiency-funnel: total_expenses includes ad_spend; other = total − min(ad, total);
 * operating = revenue − other; net = revenue − total_expenses.
 * Returns null when there is no overlapping month data.
 */
export function computeEfficiencyFunnelFromMonthlySeries(profitMarginData, anomalyData) {
  const byPeriod = new Map();
  const datesPm = profitMarginData?.date ?? [];
  for (let i = 0; i < datesPm.length; i += 1) {
    const p = datesPm[i];
    const row = byPeriod.get(p) ?? { total_revenue: 0, total_expenses: 0, ad_spend: 0 };
    row.total_revenue += Number(profitMarginData.total_revenue?.[i] ?? 0);
    byPeriod.set(p, row);
  }
  const datesAn = anomalyData?.date ?? [];
  for (let i = 0; i < datesAn.length; i += 1) {
    const p = datesAn[i];
    const row = byPeriod.get(p) ?? { total_revenue: 0, total_expenses: 0, ad_spend: 0 };
    row.total_expenses += Number(anomalyData.total_expenses?.[i] ?? 0);
    row.ad_spend += Number(anomalyData.ad_spend?.[i] ?? 0);
    byPeriod.set(p, row);
  }

  if (byPeriod.size === 0) return null;

  let total_revenue = 0;
  let total_expenses = 0;
  let ad_spend = 0;
  for (const row of byPeriod.values()) {
    total_revenue += row.total_revenue;
    total_expenses += row.total_expenses;
    ad_spend += row.ad_spend;
  }

  total_revenue = Math.round(total_revenue * 100) / 100;
  total_expenses = Math.round(total_expenses * 100) / 100;
  ad_spend = Math.round(ad_spend * 100) / 100;

  const te = Math.max(0, total_expenses);
  const adPortion = Math.min(Math.max(0, ad_spend), te);
  const other_expenses = Math.round((te - adPortion) * 100) / 100;

  const operating_profit = Math.round((total_revenue - other_expenses) * 100) / 100;
  const net_profit = Math.round((total_revenue - te) * 100) / 100;
  const totalRecordedCosts = Math.round(te * 100) / 100;
  const operatingMinusNet = Math.round((operating_profit - net_profit) * 100) / 100;

  const stages = [
    { name: 'Total revenue', value: total_revenue },
    { name: 'Operating profit', value: operating_profit },
    { name: 'Net profit', value: net_profit },
  ];

  return {
    stages,
    total_revenue,
    total_expenses,
    ad_spend,
    other_expenses,
    operating_profit,
    net_profit,
    reconciliation: {
      totalRecordedCosts,
      otherExpenses: other_expenses,
      adPortion,
      operatingMinusNet,
    },
  };
}

/**
 * Same month bounds as {@link filterProfitMarginByDateRange} for ad spend ROI bubble series.
 * Recomputes `correlation` and `regression` on the visible rows only.
 */
export function filterAdSpendRoiByDateRange(data, startDate, endDate) {
  if (!data?.date?.length) return data;
  if (!startDate && !endDate) return data;
  const indices = [];
  for (let i = 0; i < data.date.length; i += 1) {
    const monthStart = expenseAnomalyPeriodToIsoMonthStart(data.date[i]);
    if (!monthStart) continue;
    if (startDate && monthStart < startDate) continue;
    if (endDate && monthStart > endDate) continue;
    indices.push(i);
  }
  const pick = (arr) => (Array.isArray(arr) ? indices.map((j) => arr[j]) : []);
  if (indices.length === 0) {
    return {
      ...data,
      date: [],
      ad_spend: [],
      total_revenue: [],
      total_expenses: [],
      profit: [],
      category: [],
      correlation: null,
      regression: null,
    };
  }
  const ad_spend = pick(data.ad_spend ?? []);
  const total_revenue = pick(data.total_revenue ?? []);
  const correlation =
    ad_spend.length >= 2 ? pearsonCorrelation(ad_spend, total_revenue) : null;
  const regression =
    ad_spend.length >= 2 ? olsSlopeIntercept(ad_spend, total_revenue) : null;
  return {
    ...data,
    date: pick(data.date),
    ad_spend,
    total_revenue,
    total_expenses: pick(data.total_expenses ?? []),
    profit: pick(data.profit ?? []),
    category: pick(data.category ?? []),
    correlation,
    regression,
  };
}

/**
 * Filters MoM elasticity pairs by month of `period` (YYYY-MM or display label), same bounds as
 * {@link filterProfitMarginByDateRange}.
 */
export function filterElasticityByDateRange(data, startDate, endDate) {
  if (!data?.period?.length) return data;
  if (!startDate && !endDate) return data;
  const indices = [];
  for (let i = 0; i < data.period.length; i += 1) {
    const monthStart = expenseAnomalyPeriodToIsoMonthStart(data.period[i]);
    if (!monthStart) continue;
    if (startDate && monthStart < startDate) continue;
    if (endDate && monthStart > endDate) continue;
    indices.push(i);
  }
  const pick = (arr) => (Array.isArray(arr) ? indices.map((j) => arr[j]) : []);
  if (indices.length === 0) {
    return {
      period: [],
      deltaExpenses: [],
      deltaRevenue: [],
      elasticity: null,
      intercept: null,
      slope: null,
    };
  }
  return {
    ...data,
    period: pick(data.period),
    deltaExpenses: pick(data.deltaExpenses ?? []),
    deltaRevenue: pick(data.deltaRevenue ?? []),
    elasticity: null,
    intercept: null,
    slope: null,
  };
}

/** Matches backend `computeLinearAnomalySeries` trailing fit window (months). */
export const EXPENSE_ANOMALY_OLS_TRAIL_MONTHS = 24;

/** jStat default: population stdev (÷ n), matching `jStat.stdev(residuals)` one-arg call. */
function populationStdev(values) {
  const nums = values.map(Number).filter((x) => Number.isFinite(x));
  const n = nums.length;
  if (n < 1) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / n;
  const v = nums.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  return Math.sqrt(Math.max(v, 0));
}

function olsInterceptSlopeUnrounded(xs, ys) {
  const n = Math.min(xs?.length ?? 0, ys?.length ?? 0);
  if (n < 2) return null;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i += 1) {
    mx += Number(xs[i]);
    my += Number(ys[i]);
  }
  mx /= n;
  my /= n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = Number(xs[i]) - mx;
    num += dx * (Number(ys[i]) - my);
    den += dx * dx;
  }
  if (den === 0) return null;
  const slope = num / den;
  const intercept = my - slope * mx;
  return { intercept, slope };
}

/**
 * Re-fits trend and ±2σ residual bands on the current series only (same method as the API
 * computeLinearAnomalySeries): OLS on the last EXPENSE_ANOMALY_OLS_TRAIL_MONTHS
 * points, trend evaluated at every visible index, bands from population stdev of residuals.
 * Preserves date, total_expenses, ad_spend, notes, recordId.
 */
export function recomputeExpenseAnomalyLinearFit(
  data,
  trailMonths = EXPENSE_ANOMALY_OLS_TRAIL_MONTHS
) {
  if (!data?.date?.length) return data;
  const values = (data.total_expenses ?? []).map((v) => Number(v));
  const n = values.length;
  if (n === 0) return data;

  if (n < 2) {
    const y = Math.round(values[0] * 100) / 100;
    return {
      ...data,
      trend: [y],
      trend_upper: [y],
      trend_lower: [y],
      upperBand: [y],
      lowerBand: [y],
      isAnomaly: [false],
      outliers: [false],
    };
  }

  const fitStart = n > trailMonths ? n - trailMonths : 0;
  const fitLen = n - fitStart;
  const xs = Array.from({ length: fitLen }, (_, j) => fitStart + j);
  const ys = values.slice(fitStart);
  const model = olsInterceptSlopeUnrounded(xs, ys);
  if (!model) {
    return {
      ...data,
      trend: values.map(() => null),
      trend_upper: [],
      trend_lower: [],
      upperBand: [],
      lowerBand: [],
      isAnomaly: values.map(() => false),
      outliers: values.map(() => false),
    };
  }
  const { intercept, slope } = model;
  const time = values.map((_, i) => i);
  const trend = time.map((t) => Math.round((intercept + slope * t) * 100) / 100);
  const residuals = values.map((v, i) => v - trend[i]);
  const sigma = populationStdev(residuals);
  const residualStdDev = Number.isFinite(sigma) ? sigma : 0;
  const thresholdDistance = 2 * residualStdDev;
  const upperBand = trend.map((v) => Math.round((v + thresholdDistance) * 100) / 100);
  const lowerBand = trend.map((v) => Math.round((v - thresholdDistance) * 100) / 100);
  const isAnomaly = values.map((actual, i) => actual > upperBand[i] || actual < lowerBand[i]);
  const outliers = [...isAnomaly];

  return {
    ...data,
    trend,
    trend_upper: [...upperBand],
    trend_lower: [...lowerBand],
    upperBand,
    lowerBand,
    isAnomaly,
    outliers,
  };
}

export function sliceAdSpendRoiData(data, lastPeriods) {
  if (!data?.date?.length) return data;
  if (lastPeriods == null) return data;
  const n = data.date.length;
  const start = Math.max(0, n - lastPeriods);
  const ad_spend = data.ad_spend?.slice(start) ?? [];
  const total_revenue = data.total_revenue?.slice(start) ?? [];
  const correlation =
    ad_spend.length >= 2 ? pearsonCorrelation(ad_spend, total_revenue) : null;
  const regression =
    ad_spend.length >= 2 ? olsSlopeIntercept(ad_spend, total_revenue) : null;
  return {
    ...data,
    date: data.date.slice(start),
    ad_spend,
    total_revenue,
    total_expenses: data.total_expenses?.slice(start) ?? [],
    profit: data.profit?.slice(start) ?? [],
    category: data.category?.slice(start) ?? [],
    correlation,
    regression,
  };
}

const ROI_HIST_NUM_BINS_DEFAULT = 8;
const ROI_HIST_NUM_BINS_ZOOM = 12;

function roiHistSortedPercentile(sorted, p) {
  const m = sorted.length;
  if (m === 0) return 0;
  if (m === 1) return sorted[0];
  const x = p * (m - 1);
  const i0 = Math.floor(x);
  const i1 = Math.ceil(x);
  if (i0 === i1) return sorted[i0];
  return sorted[i0] + (sorted[i1] - sorted[i0]) * (x - i0);
}

function roiHistSampleStdev(values) {
  const nums = values.map(Number).filter((x) => Number.isFinite(x));
  const n = nums.length;
  if (n < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / n;
  const v = nums.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(Math.max(v, 0));
}

/** Matches backend `roiHistogramWindow` (chartController) for consistent bins after date filter. */
function roiHistogramWindow(roiValues) {
  const n = roiValues.length;
  const minR = Math.min(...roiValues);
  const maxR = Math.max(...roiValues);
  const range = maxR - minR;
  const mean = roiValues.reduce((a, b) => a + b, 0) / n;
  const sd = roiHistSampleStdev(roiValues);

  const sorted = [...roiValues].sort((a, b) => a - b);
  const q1 = roiHistSortedPercentile(sorted, 0.25);
  const q3 = roiHistSortedPercentile(sorted, 0.75);
  const iqr = Math.max(0, q3 - q1);

  const fd = iqr > 0 && n > 1 ? (2 * iqr) / Math.cbrt(n) : 0;

  const edgePad = Math.max(range * 0.03, Math.abs(mean) * 1e-10, 1e-12);
  let lo = minR - edgePad;
  let hi = maxR + edgePad;
  if (!(hi > lo)) {
    const eps = Math.max(Math.abs(minR) * 1e-6, 1e-8);
    lo = minR - eps;
    hi = maxR + eps;
  }
  let span = hi - lo;

  const minSpan = Math.max(
    span,
    4 * sd,
    2.5 * iqr,
    Math.abs(mean) * 0.0025,
    range < 1e-14 ? Math.abs(mean) * 0.02 : 0,
    fd > 0 ? fd * 4 : 0,
    1e-10
  );
  if (span < minSpan) {
    const mid = (minR + maxR) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
    span = hi - lo;
  }

  if (minR < lo) lo = minR - Math.max(span * 0.01, 1e-10);
  if (maxR > hi) hi = maxR + Math.max(span * 0.01, 1e-10);

  const narrow = maxR - minR < 0.2;
  const numBins = n >= 36 && narrow ? ROI_HIST_NUM_BINS_ZOOM : ROI_HIST_NUM_BINS_DEFAULT;

  return { lo, hi, numBins };
}

/**
 * Per-period ROI values where the marketing portion of spend is positive; same formula as the ROI histogram API:
 * (total_revenue - total_expenses) / min(ad_spend, total_expenses).
 */
export function extractAdSpendRoiValuesForHistogram(data) {
  if (!data?.date?.length) return [];
  const out = [];
  const n = data.date.length;
  for (let i = 0; i < n; i += 1) {
    const rev = Number(data.total_revenue?.[i]);
    const te = Math.max(0, Number(data.total_expenses?.[i] ?? 0));
    const adRaw = Number(data.ad_spend?.[i]);
    const ad = Math.min(Math.max(0, Number.isFinite(adRaw) ? adRaw : 0), te);
    if (!(ad > 0)) continue;
    const net = rev - te;
    const roi = net / ad;
    if (Number.isFinite(roi)) out.push(roi);
  }
  return out;
}

/**
 * Builds `binLabels` / `counts` / `roiValues` like GET /roi-distribution-histogram (for client-side filtering).
 */
export function buildRoiHistogramFromRoiValues(roiValues) {
  if (!roiValues?.length) {
    return { binLabels: [], counts: [], roiValues: [] };
  }
  const { lo, hi, numBins } = roiHistogramWindow(roiValues);
  const width = (hi - lo) / numBins;
  const binLabels = [];
  const counts = [];
  for (let i = 0; i < numBins; i += 1) {
    const a = lo + i * width;
    const b = lo + (i + 1) * width;
    const decimals = width >= 0.1 ? 2 : width >= 0.01 ? 3 : 4;
    binLabels.push(`${a.toFixed(decimals)}–${b.toFixed(decimals)}x`);
    counts.push(0);
  }
  for (const roi of roiValues) {
    let idx = Math.floor((roi - lo) / width);
    if (idx < 0) idx = 0;
    if (idx >= numBins) idx = numBins - 1;
    counts[idx] += 1;
  }
  return { binLabels, counts, roiValues: [...roiValues] };
}
