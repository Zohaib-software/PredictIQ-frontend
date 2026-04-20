import { useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { chartsApi, createCostsSummaryFetcher } from '../../api/chartsApi';
import { useChart } from '../../hooks/useChart';
import { ChartCard } from '../../components/dashboard/ChartCard';
import { CostViewToggleCard } from '../../components/dashboard/CostViewToggleCard';
import { FilterBar } from '../../components/dashboard/FilterBar';
import { ExpenseAnomalyChart } from '../../components/dashboard/charts/ExpenseAnomalyChart';
import { CorrelationHeatmap } from '../../components/dashboard/charts/CorrelationHeatmap';
import { ElasticityChart } from '../../components/dashboard/charts/ElasticityChart';
import { EfficiencyFunnelChart } from '../../components/dashboard/charts/EfficiencyFunnelChart';
import { ProfitMarginChart } from '../../components/dashboard/charts/ProfitMarginChart';
import { AdSpendRevenueChart } from '../../components/dashboard/charts/AdSpendRevenueChart';
import { AdSpendRoiChart } from '../../components/dashboard/charts/AdSpendRoiChart';
import { RoiHistogramChart } from '../../components/dashboard/charts/RoiHistogramChart';
import {
  buildAdSpendRevenueMergedChartRows,
  buildRoiHistogramFromRoiValues,
  extractAdSpendRoiValuesForHistogram,
  filterAdSpendRoiByDateRange,
  filterExpenseAnomalyByDateRange,
  filterProfitMarginByDateRange,
  computeEfficiencyFunnelFromMonthlySeries,
  recomputeExpenseAnomalyLinearFit,
  sliceAdSpendRoiData,
  sliceExpenseAnomalyData,
  sliceProfitMarginData,
} from '../../utils/chartSeriesRange';
import { filterForecastChartRowsByDateRange } from '../../utils/forecastChartDisplay';
import { useFinancialRecords } from '../../context/FinancialRecordsContext';
import { useAuth } from '../../context/AuthContext';
import { canUseForecastingTools } from '../../utils/forecastingAccess';
import { parseMonthlyLabelToYm } from '../../utils/seriesProjection';
import {
  computeSmallScreenDefaultIsoDatesFromMonthlyRecords,
  matchesSmallScreenForDefaultChartDates,
} from '../../utils/smallScreenDefaultChartDateRange';
import { useChartFilters } from '../../hooks/useChartFilters';
import { expenseAnomalyProjectionVisibleInDateRange } from '../../utils/expenseAnomalyProjectionUi';
import pageStyles from './DashboardPages.module.css';
import chartLayoutStyles from './DataPage.module.css';
import styles from './ReportsPage.module.css';

function toIsoMonthStart(periodLabel) {
  const ym = parseMonthlyLabelToYm(String(periodLabel ?? '').trim());
  return ym ? `${ym}-01` : null;
}

function isWithinDateRange(periodLabel, startDate, endDate) {
  const monthStart = toIsoMonthStart(periodLabel);
  if (!monthStart) return false;
  if (startDate && monthStart < startDate) return false;
  if (endDate && monthStart > endDate) return false;
  return true;
}

function pearsonCorrelation(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;
  for (let i = 0; i < n; i += 1) {
    const x = Number(xs[i]);
    const y = Number(ys[i]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumYY += y * y;
    sumXY += x * y;
  }
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    Math.max(n * sumXX - sumX * sumX, 0) * Math.max(n * sumYY - sumY * sumY, 0)
  );
  if (!Number.isFinite(denominator) || denominator === 0) return 0;
  return Math.max(-1, Math.min(1, numerator / denominator));
}

function CostAnalysisTab({ highlightPeriod, anomalyFocusKey, narrowLayout, forecastingLocked }) {
  const prevAnomalyFocusRef = useRef(null);
  const [breakdownStartDate, setBreakdownStartDate] = useState('');
  const [breakdownEndDate, setBreakdownEndDate] = useState('');
  const costsSummaryFetcher = useMemo(
    () => createCostsSummaryFetcher(breakdownStartDate, breakdownEndDate),
    [breakdownStartDate, breakdownEndDate]
  );
  const costsSummary = useChart(costsSummaryFetcher, [breakdownStartDate, breakdownEndDate]);
  const expenseVolatilityGauge = useChart(chartsApi.expenseVolatilityGauge);
  const correlationHeatmap = useChart(chartsApi.correlationHeatmap);
  const expenseRevenueElasticity = useChart(chartsApi.expenseRevenueElasticity);
  const costBreakdown = costsSummary.data?.costBreakdown;
  const anomaly = costsSummary.data?.expenseAnomaly;
  const profitMargin = costsSummary.data?.profitMargin;

  const anomalyFilters = useChartFilters('costs_expense_anomaly');
  const marginFilters = useChartFilters('costs_profit_margin');
  const elasticityFilters = useChartFilters('reports_expense_revenue_elasticity');
  const [volatilityStartDate, setVolatilityStartDate] = useState('');
  const [volatilityEndDate, setVolatilityEndDate] = useState('');
  const [correlationStartDate, setCorrelationStartDate] = useState('');
  const [correlationEndDate, setCorrelationEndDate] = useState('');
  const [anomalyStartDate, setAnomalyStartDate] = useState('');
  const [anomalyEndDate, setAnomalyEndDate] = useState('');
  const [marginStartDate, setMarginStartDate] = useState('');
  const [marginEndDate, setMarginEndDate] = useState('');
  const [elasticityStartDate, setElasticityStartDate] = useState('');
  const [elasticityEndDate, setElasticityEndDate] = useState('');
  const [funnelStartDate, setFunnelStartDate] = useState('');
  const [funnelEndDate, setFunnelEndDate] = useState('');

  const reportsCostTabDateInitRef = useRef({ consumed: false, userResetFilters: false });
  const markReportsCostTabDateFilterResetIntent = () => {
    reportsCostTabDateInitRef.current.userResetFilters = true;
    reportsCostTabDateInitRef.current.consumed = true;
  };

  const resetVolatilityDateRange = () => {
    markReportsCostTabDateFilterResetIntent();
    setVolatilityStartDate('');
    setVolatilityEndDate('');
  };

  const resetBreakdownDateRange = () => {
    markReportsCostTabDateFilterResetIntent();
    setBreakdownStartDate('');
    setBreakdownEndDate('');
  };

  const resetCorrelationDateRange = () => {
    markReportsCostTabDateFilterResetIntent();
    setCorrelationStartDate('');
    setCorrelationEndDate('');
  };

  const resetAnomalyDateRange = () => {
    markReportsCostTabDateFilterResetIntent();
    setAnomalyStartDate('');
    setAnomalyEndDate('');
  };

  const resetMarginDateRange = () => {
    markReportsCostTabDateFilterResetIntent();
    setMarginStartDate('');
    setMarginEndDate('');
  };

  const resetElasticityDateRange = () => {
    markReportsCostTabDateFilterResetIntent();
    setElasticityStartDate('');
    setElasticityEndDate('');
  };

  const resetFunnelDateRange = () => {
    markReportsCostTabDateFilterResetIntent();
    setFunnelStartDate('');
    setFunnelEndDate('');
  };

  useEffect(() => {
    if (reportsCostTabDateInitRef.current.consumed) return;
    if (costsSummary.loading) return;
    const periodList = anomaly?.date ?? [];
    const records = periodList.map((period) => ({ period }));
    if (records.length === 0) return;

    if (reportsCostTabDateInitRef.current.userResetFilters) {
      reportsCostTabDateInitRef.current.consumed = true;
      return;
    }

    if (!matchesSmallScreenForDefaultChartDates()) {
      reportsCostTabDateInitRef.current.consumed = true;
      return;
    }

    const range = computeSmallScreenDefaultIsoDatesFromMonthlyRecords(records);
    if (!range) {
      reportsCostTabDateInitRef.current.consumed = true;
      return;
    }

    reportsCostTabDateInitRef.current.consumed = true;
    const { startDate: sd, endDate: ed } = range;
    setBreakdownStartDate(sd);
    setBreakdownEndDate(ed);
    setVolatilityStartDate(sd);
    setVolatilityEndDate(ed);
    setCorrelationStartDate(sd);
    setCorrelationEndDate(ed);
    setAnomalyStartDate(sd);
    setAnomalyEndDate(ed);
    setMarginStartDate(sd);
    setMarginEndDate(ed);
    setElasticityStartDate(sd);
    setElasticityEndDate(ed);
    setFunnelStartDate(sd);
    setFunnelEndDate(ed);
  }, [costsSummary.loading, anomaly?.date]);

  const filteredVolatilityData = useMemo(() => {
    const volatilityBase = expenseVolatilityGauge.data;
    if (!volatilityBase) return volatilityBase;
    if (!volatilityStartDate && !volatilityEndDate) return volatilityBase;
    const periods = anomaly?.date ?? [];
    const expenses = anomaly?.total_expenses ?? [];
    const inRangeExpenses = periods
      .map((period, idx) => ({ period, value: Number(expenses[idx] ?? 0) }))
      .filter((row) =>
        Number.isFinite(row.value) &&
        isWithinDateRange(row.period, volatilityStartDate, volatilityEndDate)
      )
      .map((row) => row.value);

    if (inRangeExpenses.length < 2) {
      return { ...volatilityBase, score: 0, volatility: 0, mean: 0, periodCount: inRangeExpenses.length };
    }
    const mean = inRangeExpenses.reduce((sum, value) => sum + value, 0) / inRangeExpenses.length;
    const variance =
      inRangeExpenses.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      (inRangeExpenses.length - 1);
    const volatility = Math.sqrt(Math.max(variance, 0));
    const cv = mean > 0 ? (volatility / mean) * 100 : 0;
    const score = Math.min(100, Math.round(cv * 10) / 10);

    return {
      ...volatilityBase,
      score,
      volatility: Math.round(volatility * 100) / 100,
      mean: Math.round(mean * 100) / 100,
      periodCount: inRangeExpenses.length,
    };
  }, [anomaly, expenseVolatilityGauge.data, volatilityEndDate, volatilityStartDate]);

  const filteredCostBreakdown = useMemo(() => {
    if (!costBreakdown) return costBreakdown;
    const labels = (costBreakdown.labels ?? []).map((label) => String(label).toLowerCase());
    const isExpenseAdTwoBucket =
      labels.length === 2 &&
      labels.includes('ad spend') &&
      (labels.includes('expenses') || labels.includes('other expenses'));
    if (!isExpenseAdTwoBucket) return costBreakdown;
    if (!breakdownStartDate && !breakdownEndDate) return costBreakdown;
    const periods = anomaly?.date ?? [];
    const totalExpenses = anomaly?.total_expenses ?? [];
    const adSpend = anomaly?.ad_spend ?? [];
    const totals = periods.reduce(
      (acc, period, idx) => {
        if (!isWithinDateRange(period, breakdownStartDate, breakdownEndDate)) return acc;
        acc.expenses += Number(totalExpenses[idx] ?? 0);
        acc.adSpend += Number(adSpend[idx] ?? 0);
        return acc;
      },
      { expenses: 0, adSpend: 0 }
    );

    const te = Math.max(0, totals.expenses);
    const adPortion = Math.min(Math.max(0, totals.adSpend), te);
    const otherPortion = Math.round((te - adPortion) * 100) / 100;

    return {
      ...costBreakdown,
      labels: ['Other expenses', 'Ad spend'],
      values: [otherPortion, Math.round(adPortion * 100) / 100],
    };
  }, [anomaly, breakdownEndDate, breakdownStartDate, costBreakdown]);

  const filteredCorrelationHeatmap = useMemo(() => {
    const base = correlationHeatmap.data;
    if (!base) return base;
    if (!correlationStartDate && !correlationEndDate) return base;

    const labels = (base.labels ?? []).filter((label) =>
      ['total_revenue', 'total_expenses', 'gross_profit', 'other_expenses'].includes(label)
    );
    if (!labels.length) return base;

    const byPeriod = new Map();
    const anomalyPeriods = anomaly?.date ?? [];
    const anomalyExpenses = anomaly?.total_expenses ?? [];
    const anomalyAdSpend = anomaly?.ad_spend ?? [];
    for (let i = 0; i < anomalyPeriods.length; i += 1) {
      const period = anomalyPeriods[i];
      if (!isWithinDateRange(period, correlationStartDate, correlationEndDate)) continue;
      const row = byPeriod.get(period) ?? {};
      const te = Number(anomalyExpenses[i] ?? 0);
      const adRaw = Number(anomalyAdSpend[i] ?? 0);
      row.total_expenses = te;
      row.ad_spend = adRaw;
      const adPortion = Math.min(Math.max(0, adRaw), Math.max(0, te));
      row.other_expenses = Math.round((Math.max(0, te) - adPortion) * 100) / 100;
      byPeriod.set(period, row);
    }

    const marginPeriods = profitMargin?.date ?? [];
    const marginRevenue = profitMargin?.total_revenue ?? [];
    const marginGross = profitMargin?.gross_profit ?? [];
    for (let i = 0; i < marginPeriods.length; i += 1) {
      const period = marginPeriods[i];
      if (!isWithinDateRange(period, correlationStartDate, correlationEndDate)) continue;
      const row = byPeriod.get(period) ?? {};
      row.total_revenue = Number(marginRevenue[i] ?? 0);
      row.gross_profit = Number(marginGross[i] ?? 0);
      byPeriod.set(period, row);
    }

    const rows = Array.from(byPeriod.values()).filter(
      (row) =>
        Number.isFinite(row.total_revenue) &&
        Number.isFinite(row.total_expenses) &&
        Number.isFinite(row.gross_profit) &&
        Number.isFinite(row.other_expenses)
    );
    if (rows.length < 2) {
      const size = labels.length;
      return {
        labels,
        matrix: Array.from({ length: size }, (_, i) =>
          Array.from({ length: size }, (_, j) => (i === j ? 1 : 0))
        ),
      };
    }

    const vectors = labels.map((label) => rows.map((row) => Number(row[label] ?? 0)));
    const matrix = labels.map((_, rowIdx) =>
      labels.map((__, colIdx) => {
        if (rowIdx === colIdx) return 1;
        const corr = pearsonCorrelation(vectors[rowIdx], vectors[colIdx]);
        return Math.round(corr * 100) / 100;
      })
    );
    return { labels, matrix };
  }, [
    anomaly,
    profitMargin,
    correlationEndDate,
    correlationHeatmap.data,
    correlationStartDate,
  ]);

  const anomalySliced = useMemo(() => sliceExpenseAnomalyData(anomaly, null), [anomaly]);
  const anomalyDateFiltered = useMemo(
    () => filterExpenseAnomalyByDateRange(anomalySliced, anomalyStartDate, anomalyEndDate),
    [anomalySliced, anomalyStartDate, anomalyEndDate]
  );
  const anomalyDisplay = useMemo(
    () => recomputeExpenseAnomalyLinearFit(anomalyDateFiltered),
    [anomalyDateFiltered]
  );
  const anomalyFitFull = useMemo(
    () => recomputeExpenseAnomalyLinearFit(anomalySliced),
    [anomalySliced]
  );
  const profitMarginSliced = useMemo(() => sliceProfitMarginData(profitMargin, null), [profitMargin]);
  const profitMarginDisplay = useMemo(
    () => filterProfitMarginByDateRange(profitMarginSliced, marginStartDate, marginEndDate),
    [profitMarginSliced, marginStartDate, marginEndDate]
  );

  const funnelProfitMarginFiltered = useMemo(
    () => filterProfitMarginByDateRange(profitMarginSliced, funnelStartDate, funnelEndDate),
    [profitMarginSliced, funnelStartDate, funnelEndDate]
  );
  const funnelAnomalyFiltered = useMemo(
    () => filterExpenseAnomalyByDateRange(anomalySliced, funnelStartDate, funnelEndDate),
    [anomalySliced, funnelStartDate, funnelEndDate]
  );
  const efficiencyFunnelDisplay = useMemo(
    () => computeEfficiencyFunnelFromMonthlySeries(funnelProfitMarginFiltered, funnelAnomalyFiltered),
    [funnelProfitMarginFiltered, funnelAnomalyFiltered]
  );

  const breakdown = costBreakdown;
  const hasCostBreakdownData =
    !!filteredCostBreakdown?.labels?.length &&
    (filteredCostBreakdown?.values ?? []).some((value) => Number(value) > 0);
  const hasAnomalySlicedSeries =
    !!anomalySliced?.date?.length &&
    (anomalySliced?.total_expenses ?? []).some((value) => Number(value) > 0);
  const hasProfitMarginSlicedSeries =
    !!profitMarginSliced?.date?.length &&
    (profitMarginSliced?.profit_margin ?? []).some(
      (value) => value != null && Number.isFinite(Number(value))
    );
  const hasProfitMarginData =
    !!profitMarginDisplay?.date?.length &&
    (profitMarginDisplay?.profit_margin ?? []).some(
      (value) => value != null && Number.isFinite(Number(value))
    );
  const hasVolatilityData =
    filteredVolatilityData?.score != null &&
    Number.isFinite(Number(filteredVolatilityData?.score));
  const hasCorrelationHeatmapData =
    !!filteredCorrelationHeatmap?.labels?.length &&
    !!filteredCorrelationHeatmap?.matrix?.length;
  const hasElasticityData =
    !!expenseRevenueElasticity.data?.period?.length &&
    !!expenseRevenueElasticity.data?.deltaExpenses?.length &&
    !!expenseRevenueElasticity.data?.deltaRevenue?.length;
  const hasEfficiencyFunnelData =
    !!efficiencyFunnelDisplay?.stages?.length &&
    (Number(efficiencyFunnelDisplay.total_revenue) > 0 ||
      Number(efficiencyFunnelDisplay.total_expenses) > 0 ||
      Number(efficiencyFunnelDisplay.ad_spend) > 0);

  const anomalyShowProjectionUi = useMemo(() => {
    const seriesForProjectionUi =
      anomalyDisplay?.date?.length > 0 ? anomalyDisplay : anomalySliced;
    return expenseAnomalyProjectionVisibleInDateRange(
      seriesForProjectionUi,
      anomalyStartDate,
      anomalyEndDate,
      anomalyFilters.projectionMonths
    );
  }, [
    anomalyDisplay,
    anomalySliced,
    anomalyStartDate,
    anomalyEndDate,
    anomalyFilters.projectionMonths,
  ]);

  const profitMarginShowProjectionUi = useMemo(() => {
    const seriesForProjectionUi =
      profitMarginDisplay?.date?.length > 0 ? profitMarginDisplay : profitMarginSliced;
    return expenseAnomalyProjectionVisibleInDateRange(
      seriesForProjectionUi,
      marginStartDate,
      marginEndDate,
      marginFilters.projectionMonths
    );
  }, [
    profitMarginDisplay,
    profitMarginSliced,
    marginStartDate,
    marginEndDate,
    marginFilters.projectionMonths,
  ]);

  const elasticityShowProjectionUi = useMemo(
    () =>
      expenseAnomalyProjectionVisibleInDateRange(
        { date: expenseRevenueElasticity.data?.period ?? [] },
        elasticityStartDate,
        elasticityEndDate,
        elasticityFilters.projectionMonths
      ),
    [
      expenseRevenueElasticity.data?.period,
      elasticityStartDate,
      elasticityEndDate,
      elasticityFilters.projectionMonths,
    ]
  );

  /** If deep-linked highlight is hidden by the date filter, clear dates so the point exists on the chart. */
  useEffect(() => {
    if (!highlightPeriod || !anomaly?.date?.length) return;
    if ((anomalyDisplay?.date ?? []).includes(highlightPeriod)) return;
    if (!anomaly.date.includes(highlightPeriod)) return;
    setAnomalyStartDate('');
    setAnomalyEndDate('');
  }, [highlightPeriod, anomaly, anomalyDisplay]);

  useEffect(() => {
    if (!highlightPeriod) return;
    const prevFocus = prevAnomalyFocusRef.current;
    const fromNotification = anomalyFocusKey != null && String(anomalyFocusKey).length > 0;
    const lostFocusOnly =
      !fromNotification && prevFocus != null && String(prevFocus).length > 0 && anomalyFocusKey == null;
    prevAnomalyFocusRef.current = anomalyFocusKey;
    if (lostFocusOnly) return;

    const t = window.setTimeout(() => {
      document.getElementById('expense-anomaly-detection')?.scrollIntoView({
        behavior: fromNotification ? 'auto' : 'smooth',
        block: 'start',
      });
    }, fromNotification ? 0 : 200);
    return () => window.clearTimeout(t);
  }, [highlightPeriod, anomalyDisplay, anomalyFocusKey]);

  const chartShell = (node) =>
    narrowLayout ? <div className={styles.reportsChartFitContent}>{node}</div> : node;

  return (
    <div className={narrowLayout ? styles.reportsTabStackMobile : pageStyles.layoutStack}>
      <div
        className={`${pageStyles.rowTwoColumn} ${styles.costAnalysisRowOne} ${
          narrowLayout ? chartLayoutStyles.chartSectionFullBleed : ''
        } ${narrowLayout ? styles.reportsCostRowOneMobile : ''}`.trim()}
        style={narrowLayout ? { gap: 0 } : undefined}
      >
        <CostViewToggleCard
          className={`${narrowLayout ? '' : pageStyles.twoColumnCard} ${styles.rowOneCellFill}`.trim()}
          narrowLayout={narrowLayout}
          volatilityData={filteredVolatilityData}
          volatilityLoading={expenseVolatilityGauge.loading}
          volatilityError={expenseVolatilityGauge.error}
          hasVolatilityData={hasVolatilityData}
          costBreakdownData={filteredCostBreakdown}
          costBreakdownLoading={costsSummary.loading}
          costBreakdownError={costsSummary.error}
          hasCostBreakdownData={hasCostBreakdownData}
          volatilityStartDate={volatilityStartDate}
          onVolatilityStartDateChange={setVolatilityStartDate}
          volatilityEndDate={volatilityEndDate}
          onVolatilityEndDateChange={setVolatilityEndDate}
          onResetVolatilityDateRange={resetVolatilityDateRange}
          breakdownStartDate={breakdownStartDate}
          onBreakdownStartDateChange={setBreakdownStartDate}
          breakdownEndDate={breakdownEndDate}
          onBreakdownEndDateChange={setBreakdownEndDate}
          onResetBreakdownDateRange={resetBreakdownDateRange}
        />
        <ChartCard
          className={`${narrowLayout ? '' : pageStyles.twoColumnCard} ${styles.rowOneCellFill}`.trim()}
          flatLayout={narrowLayout}
          filtersBarGapPx={narrowLayout ? 6 : 10}
          title="Correlation Heatmap"
          subtitle="Pairwise correlation between revenue, total expenses, gross profit, and other expenses (total expenses minus the marketing portion). Stronger values mean those metrics tend to move together."
          loading={correlationHeatmap.loading}
          error={correlationHeatmap.error}
          hasData={hasCorrelationHeatmapData}
          filtersBar={
            <FilterBar
              startDate={correlationStartDate}
              onStartDateChange={setCorrelationStartDate}
              endDate={correlationEndDate}
              onEndDateChange={setCorrelationEndDate}
              onReset={resetCorrelationDateRange}
              idPrefix="reports-correlation-date-range"
              variant="plain"
            />
          }
        >
          {narrowLayout ? (
            <div
              className={`${chartLayoutStyles.chartPlotCompact} ${styles.reportsCorrelationHeatmapPlotMobile}`}
            >
              <CorrelationHeatmap data={filteredCorrelationHeatmap} intrinsicHeight />
            </div>
          ) : (
            <CorrelationHeatmap data={filteredCorrelationHeatmap} />
          )}
        </ChartCard>
      </div>
      <div
        id="expense-anomaly-detection"
        className={`${pageStyles.rowFullTall} ${
          narrowLayout ? chartLayoutStyles.chartSectionFullBleed : ''
        }`.trim()}
      >
        <ChartCard
          className={narrowLayout ? '' : pageStyles.fullWidthTallCard}
          flatLayout={narrowLayout}
          filtersBarGapPx={narrowLayout ? 6 : 10}
          title="Expense anomaly detection"
          subtitle="Monthly expense totals versus a trend line and upper/lower bands; months outside the bands are flagged as unusual spending."
          showProjectionControls={
            !forecastingLocked &&
            !costsSummary.loading &&
            !costsSummary.error &&
            hasAnomalySlicedSeries &&
            anomalyShowProjectionUi
          }
          forecastingLocked={forecastingLocked}
          loading={costsSummary.loading}
          error={costsSummary.error}
          hasData={hasAnomalySlicedSeries}
          filtersBar={
            <FilterBar
              startDate={anomalyStartDate}
              onStartDateChange={setAnomalyStartDate}
              endDate={anomalyEndDate}
              onEndDateChange={setAnomalyEndDate}
              onReset={resetAnomalyDateRange}
              idPrefix="reports-costs-anomaly-date-range"
              variant="plain"
            />
          }
          projectionMonths={anomalyFilters.projectionMonths}
          onProjectionChange={anomalyFilters.setProjectionMonths}
        >
          {narrowLayout ? (
            <div className={styles.reportsChartFitContent}>
              <ExpenseAnomalyChart
                data={anomalyFitFull}
                startDate={anomalyStartDate}
                endDate={anomalyEndDate}
                projectionMonths={anomalyFilters.projectionMonths}
                highlightPeriod={highlightPeriod}
                enableProjection={anomalyShowProjectionUi && !forecastingLocked}
              />
            </div>
          ) : (
            <ExpenseAnomalyChart
              data={anomalyFitFull}
              startDate={anomalyStartDate}
              endDate={anomalyEndDate}
              projectionMonths={anomalyFilters.projectionMonths}
              highlightPeriod={highlightPeriod}
              enableProjection={anomalyShowProjectionUi && !forecastingLocked}
            />
          )}
        </ChartCard>
      </div>
      <div
        className={`${pageStyles.rowTwoColumn} ${
          narrowLayout ? chartLayoutStyles.chartSectionFullBleed : ''
        } ${narrowLayout ? styles.reportsCostRowOneMobile : ''}`.trim()}
        style={narrowLayout ? { gap: 0 } : undefined}
      >
        <ChartCard
          className={narrowLayout ? '' : pageStyles.twoColumnCard}
          flatLayout={narrowLayout}
          filtersBarGapPx={narrowLayout ? 6 : 10}
          title="Profit Margin % Over Time"
          subtitle="Gross profit as a percentage of revenue by month so you can see whether each pound of sales retains more or less profit over time."
          showProjectionControls={
            !forecastingLocked &&
            !costsSummary.loading &&
            !costsSummary.error &&
            hasProfitMarginData &&
            profitMarginShowProjectionUi
          }
          forecastingLocked={forecastingLocked}
          loading={costsSummary.loading}
          error={costsSummary.error}
          hasData={hasProfitMarginSlicedSeries}
          filtersBar={
            <FilterBar
              startDate={marginStartDate}
              onStartDateChange={setMarginStartDate}
              endDate={marginEndDate}
              onEndDateChange={setMarginEndDate}
              onReset={resetMarginDateRange}
              idPrefix="reports-costs-margin-date-range"
              variant="plain"
            />
          }
          projectionMonths={marginFilters.projectionMonths}
          onProjectionChange={marginFilters.setProjectionMonths}
        >
          {narrowLayout ? (
            <div className={styles.reportsChartFitContent}>
              <ProfitMarginChart
                data={profitMarginSliced}
                startDate={marginStartDate}
                endDate={marginEndDate}
                projectionMonths={marginFilters.projectionMonths}
                enableProjection={profitMarginShowProjectionUi && !forecastingLocked}
              />
            </div>
          ) : (
            <ProfitMarginChart
              data={profitMarginSliced}
              startDate={marginStartDate}
              endDate={marginEndDate}
              projectionMonths={marginFilters.projectionMonths}
              enableProjection={profitMarginShowProjectionUi && !forecastingLocked}
            />
          )}
        </ChartCard>
        <ChartCard
          className={narrowLayout ? '' : pageStyles.twoColumnCard}
          flatLayout={narrowLayout}
          filtersBarGapPx={narrowLayout ? 6 : 10}
          title="Efficiency Funnel"
          subtitle="Compares revenue with operating profit and net profit after all recorded costs so you can see how much revenue survives each stage."
          loading={costsSummary.loading}
          error={costsSummary.error}
          hasData={hasEfficiencyFunnelData}
          filtersBar={
            <FilterBar
              startDate={funnelStartDate}
              onStartDateChange={setFunnelStartDate}
              endDate={funnelEndDate}
              onEndDateChange={setFunnelEndDate}
              onReset={resetFunnelDateRange}
              idPrefix="reports-costs-funnel-date-range"
              variant="plain"
            />
          }
        >
          {chartShell(<EfficiencyFunnelChart data={efficiencyFunnelDisplay} />)}
        </ChartCard>
      </div>
      <div
        className={`${pageStyles.rowFullTall} ${
          narrowLayout ? chartLayoutStyles.chartSectionFullBleed : ''
        }`.trim()}
      >
        <ChartCard
          className={narrowLayout ? '' : pageStyles.fullWidthTallCard}
          flatLayout={narrowLayout}
          filtersBarGapPx={narrowLayout ? 6 : 10}
          title="Expense vs Revenue Elasticity Curve"
          subtitle="Each point is one month’s paired expense and revenue change vs the prior month; the line is the regression fit (elasticity)."
          showProjectionControls={
            !forecastingLocked &&
            !expenseRevenueElasticity.loading &&
            !expenseRevenueElasticity.error &&
            hasElasticityData &&
            elasticityShowProjectionUi &&
            (expenseRevenueElasticity.data?.period?.length ?? 0) >= 2
          }
          forecastingLocked={forecastingLocked}
          loading={expenseRevenueElasticity.loading}
          error={expenseRevenueElasticity.error}
          hasData={hasElasticityData}
          filtersBar={
            <FilterBar
              startDate={elasticityStartDate}
              onStartDateChange={setElasticityStartDate}
              endDate={elasticityEndDate}
              onEndDateChange={setElasticityEndDate}
              onReset={resetElasticityDateRange}
              idPrefix="reports-costs-elasticity-date-range"
              variant="plain"
            />
          }
          projectionMonths={elasticityFilters.projectionMonths}
          onProjectionChange={elasticityFilters.setProjectionMonths}
        >
          {narrowLayout ? (
            <div className={styles.reportsChartFitContent}>
              <ElasticityChart
                narrowLayout
                data={expenseRevenueElasticity.data}
                startDate={elasticityStartDate}
                endDate={elasticityEndDate}
                projectionMonths={elasticityFilters.projectionMonths}
                enableProjection={elasticityShowProjectionUi && !forecastingLocked}
              />
            </div>
          ) : (
            <ElasticityChart
              data={expenseRevenueElasticity.data}
              startDate={elasticityStartDate}
              endDate={elasticityEndDate}
              projectionMonths={elasticityFilters.projectionMonths}
              enableProjection={elasticityShowProjectionUi && !forecastingLocked}
            />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function MarketingPerformanceTab({ narrowLayout, forecastingLocked }) {
  const { hasFinancialRecords } = useFinancialRecords();
  const [adRevStartDate, setAdRevStartDate] = useState('');
  const [adRevEndDate, setAdRevEndDate] = useState('');
  const [adRoiStartDate, setAdRoiStartDate] = useState('');
  const [adRoiEndDate, setAdRoiEndDate] = useState('');
  const [roiHistStartDate, setRoiHistStartDate] = useState('');
  const [roiHistEndDate, setRoiHistEndDate] = useState('');

  const adSpendRevenue = useChart(chartsApi.adSpendRevenue);
  const adSpendRoi = useChart(chartsApi.adSpendRoi);
  const roiHistogram = useChart(chartsApi.roiDistributionHistogram);

  const marketingTabDateInitRef = useRef({ consumed: false, userResetFilters: false });
  const markMarketingTabDateFilterResetIntent = () => {
    marketingTabDateInitRef.current.userResetFilters = true;
    marketingTabDateInitRef.current.consumed = true;
  };

  useEffect(() => {
    if (marketingTabDateInitRef.current.consumed) return;
    if (adSpendRevenue.loading || adSpendRoi.loading) return;

    let records = (adSpendRevenue.data?.date ?? []).map((period) => ({ period }));
    if (records.length === 0) {
      records = (adSpendRoi.data?.date ?? []).map((period) => ({ period }));
    }
    if (records.length === 0) return;

    if (marketingTabDateInitRef.current.userResetFilters) {
      marketingTabDateInitRef.current.consumed = true;
      return;
    }

    if (!matchesSmallScreenForDefaultChartDates()) {
      marketingTabDateInitRef.current.consumed = true;
      return;
    }

    const range = computeSmallScreenDefaultIsoDatesFromMonthlyRecords(records);
    if (!range) {
      marketingTabDateInitRef.current.consumed = true;
      return;
    }

    marketingTabDateInitRef.current.consumed = true;
    const { startDate: sd, endDate: ed } = range;
    setAdRevStartDate(sd);
    setAdRevEndDate(ed);
    setAdRoiStartDate(sd);
    setAdRoiEndDate(ed);
    setRoiHistStartDate(sd);
    setRoiHistEndDate(ed);
  }, [adSpendRevenue.loading, adSpendRevenue.data, adSpendRoi.loading, adSpendRoi.data]);

  const adRevenueFilters = useChartFilters('marketing_ad_spend_revenue');

  const mergedAdSpendRevenueRows = useMemo(
    () =>
      buildAdSpendRevenueMergedChartRows(
        adSpendRevenue.data,
        adRevenueFilters.projectionMonths,
        hasFinancialRecords && !forecastingLocked
      ),
    [adSpendRevenue.data, adRevenueFilters.projectionMonths, hasFinancialRecords, forecastingLocked]
  );

  const adSpendRevenueChartRows = useMemo(
    () => filterForecastChartRowsByDateRange(mergedAdSpendRevenueRows, adRevStartDate, adRevEndDate),
    [mergedAdSpendRevenueRows, adRevStartDate, adRevEndDate]
  );

  const fullAdRevPeriodCount = adSpendRevenue.data?.date?.length ?? 0;
  const mergedHasFutureProjection = mergedAdSpendRevenueRows.length > fullAdRevPeriodCount;
  const displayHasAdRevProjection = useMemo(
    () =>
      adSpendRevenueChartRows.some(
        (r) =>
          (r.adProj != null && Number.isFinite(Number(r.adProj))) ||
          (r.revProj != null && Number.isFinite(Number(r.revProj)))
      ),
    [adSpendRevenueChartRows]
  );
  const showAdSpendRevenueProjectedSeries =
    !forecastingLocked && mergedHasFutureProjection && displayHasAdRevProjection;

  const roiDisplay = useMemo(
    () => sliceAdSpendRoiData(adSpendRoi.data, null),
    [adSpendRoi.data]
  );

  const adRoiFiltered = useMemo(
    () => filterAdSpendRoiByDateRange(roiDisplay, adRoiStartDate, adRoiEndDate),
    [roiDisplay, adRoiStartDate, adRoiEndDate]
  );

  const roiHistogramDisplay = useMemo(() => {
    const series = filterAdSpendRoiByDateRange(roiDisplay, roiHistStartDate, roiHistEndDate);
    const roiValues = extractAdSpendRoiValuesForHistogram(series);
    return buildRoiHistogramFromRoiValues(roiValues);
  }, [roiDisplay, roiHistStartDate, roiHistEndDate]);

  const hasAdSpendRevenueData =
    !!adSpendRevenue.data?.date?.length &&
    ((adSpendRevenue.data?.ad_spend ?? []).some((value) => Number(value) > 0) ||
      (adSpendRevenue.data?.total_revenue ?? []).some((value) => Number(value) > 0));
  const hasAdSpendRoiSlicedSeries =
    !!roiDisplay?.ad_spend?.length &&
    roiDisplay.ad_spend.some(
      (value) => value != null && Number.isFinite(Number(value)) && value > 0
    );
  const hasRoiHistogramSeries = extractAdSpendRoiValuesForHistogram(roiDisplay).length > 0;
  const hasRoiHistogramFilteredBins = (roiHistogramDisplay?.binLabels ?? []).length > 0;

  const chartShell = (node) =>
    narrowLayout ? <div className={styles.reportsChartFitContent}>{node}</div> : node;

  return (
    <div className={narrowLayout ? styles.reportsTabStackMobile : pageStyles.layoutStack}>
      <div
        className={`${pageStyles.rowFullTall} ${
          narrowLayout ? chartLayoutStyles.chartSectionFullBleed : ''
        }`.trim()}
      >
        <ChartCard
          className={narrowLayout ? '' : pageStyles.fullWidthTallCard}
          flatLayout={narrowLayout}
          filtersBarGapPx={narrowLayout ? 6 : 10}
          title="Ad Spend vs Revenue"
          subtitle="Ad spend is the marketing portion of your total expenses. Projection uses full monthly history; the date range only selects which months are shown."
          showProjectionControls={!forecastingLocked}
          forecastingLocked={forecastingLocked}
          loading={adSpendRevenue.loading}
          error={adSpendRevenue.error}
          hasData={hasAdSpendRevenueData}
          projectionMonths={adRevenueFilters.projectionMonths}
          onProjectionChange={adRevenueFilters.setProjectionMonths}
          filtersBar={
            <FilterBar
              startDate={adRevStartDate}
              onStartDateChange={setAdRevStartDate}
              endDate={adRevEndDate}
              onEndDateChange={setAdRevEndDate}
              onReset={() => {
                markMarketingTabDateFilterResetIntent();
                setAdRevStartDate('');
                setAdRevEndDate('');
              }}
              idPrefix="reports-marketing-ad-spend-revenue-filter"
              variant="plain"
            />
          }
        >
          {adSpendRevenueChartRows.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-secondary-text)' }}>
              No ad spend or revenue data in the selected date range. Adjust the filters or reset to see
              the full series.
            </p>
          ) : (
            chartShell(
              <AdSpendRevenueChart
                chartRows={adSpendRevenueChartRows}
                showProjectedSeries={showAdSpendRevenueProjectedSeries}
              />
            )
          )}
        </ChartCard>
      </div>
      <div
        className={`${pageStyles.rowTwoColumn} ${
          narrowLayout ? chartLayoutStyles.chartSectionFullBleed : ''
        } ${narrowLayout ? styles.reportsCostRowOneMobile : ''}`.trim()}
        style={narrowLayout ? { gap: 0 } : undefined}
      >
        <ChartCard
          className={narrowLayout ? '' : pageStyles.twoColumnCard}
          flatLayout={narrowLayout}
          filtersBarGapPx={narrowLayout ? 6 : 10}
          title="Ad Spend ROI Efficiency"
          subtitle="Each bubble is a period: marketing spend on one axis, revenue on the other; bubble size is net profit (revenue minus all expenses, including ad)."
          loading={adSpendRoi.loading}
          error={adSpendRoi.error}
          hasData={hasAdSpendRoiSlicedSeries}
          filtersBar={
            <FilterBar
              startDate={adRoiStartDate}
              onStartDateChange={setAdRoiStartDate}
              endDate={adRoiEndDate}
              onEndDateChange={setAdRoiEndDate}
              onReset={() => {
                markMarketingTabDateFilterResetIntent();
                setAdRoiStartDate('');
                setAdRoiEndDate('');
              }}
              idPrefix="reports-marketing-ad-roi-date-range"
              variant="plain"
            />
          }
        >
          {chartShell(<AdSpendRoiChart data={adRoiFiltered} />)}
        </ChartCard>
        <ChartCard
          className={narrowLayout ? '' : pageStyles.twoColumnCard}
          flatLayout={narrowLayout}
          filtersBarGapPx={narrowLayout ? 6 : 10}
          title="ROI Distribution Histogram"
          subtitle="Distribution of net profit (after all expenses) per £ of tracked marketing spend. Ad spend is part of total expenses, not subtracted twice."
          loading={adSpendRoi.loading || roiHistogram.loading}
          error={adSpendRoi.error || roiHistogram.error}
          hasData={hasRoiHistogramSeries}
          filtersBar={
            <FilterBar
              startDate={roiHistStartDate}
              onStartDateChange={setRoiHistStartDate}
              endDate={roiHistEndDate}
              onEndDateChange={setRoiHistEndDate}
              onReset={() => {
                markMarketingTabDateFilterResetIntent();
                setRoiHistStartDate('');
                setRoiHistEndDate('');
              }}
              idPrefix="reports-marketing-roi-hist-date-range"
              variant="plain"
            />
          }
        >
          {!hasRoiHistogramFilteredBins ? (
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-secondary-text)' }}>
              No ROI distribution data in the selected date range. Adjust the filters or reset to see the
              full distribution.
            </p>
          ) : (
            chartShell(<RoiHistogramChart data={roiHistogramDisplay} />)
          )}
        </ChartCard>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { user } = useAuth();
  const forecastingLocked = !canUseForecastingTools(user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('cost');
  const [highlightPeriod, setHighlightPeriod] = useState(null);
  const [narrowLayout, setNarrowLayout] = useState(false);

  const anomalyFocusKey = searchParams.get('anomalyFocus');

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setNarrowLayout(false);
      return undefined;
    }
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => setNarrowLayout(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    const h = searchParams.get('highlight');
    if (tab === 'costs' || (h != null && h.trim() !== '') || anomalyFocusKey != null) {
      setActiveTab('cost');
    }
    setHighlightPeriod(h && h.trim() ? h.trim() : null);
  }, [searchParams, anomalyFocusKey]);

  useEffect(() => {
    if (!anomalyFocusKey) return;
    const id = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('anomalyFocus');
          return next;
        },
        { replace: true }
      );
    }, 400);
    return () => window.clearTimeout(id);
  }, [anomalyFocusKey, setSearchParams]);

  return (
    <motion.div
      className={pageStyles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <header className={pageStyles.pageHeader}>
        <h1 className={pageStyles.pageTitle}>Reports</h1>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Reports tabs">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'cost'}
          className={`${styles.tabButton} ${activeTab === 'cost' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('cost')}
        >
          Cost Analysis
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'marketing'}
          className={`${styles.tabButton} ${activeTab === 'marketing' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('marketing')}
        >
          Marketing Performance
        </button>
      </div>

      {activeTab === 'cost' ? (
        <CostAnalysisTab
          highlightPeriod={highlightPeriod}
          anomalyFocusKey={anomalyFocusKey}
          narrowLayout={narrowLayout}
          forecastingLocked={forecastingLocked}
        />
      ) : (
        <MarketingPerformanceTab narrowLayout={narrowLayout} forecastingLocked={forecastingLocked} />
      )}
    </motion.div>
  );
}
