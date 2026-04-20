import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { forecastApi } from '../../api/forecastApi';
import { getFinancialData } from '../../api/dataApi';
import { ChartCard } from '../../components/dashboard/ChartCard';
import { FilterBar } from '../../components/dashboard/FilterBar';
import { ForecastVsHistoricalChart } from '../../components/dashboard/charts/ForecastVsHistoricalChart';
import { useOverviewFinancialAggregates } from '../../hooks/useOverviewFinancialAggregates';
import { SummaryCard, ForecastSummaryWidget } from '../../components/dashboard/SummaryCard';
import {
  formatGbpCompact,
  formatPercentPoints,
  getForecastAccuracyMapeTone,
} from '../../utils/displayFormat';
import { filterForecastChartRowsByDateRange } from '../../utils/forecastChartDisplay';
import { useAuth } from '../../context/AuthContext';
import { canUseForecastingTools, getForecastingLockReason } from '../../utils/forecastingAccess';
import styles from './DashboardPages.module.css';
import chartLayoutStyles from './DataPage.module.css';

export function ForecastingPage() {
  const { user } = useAuth();
  const canForecast = canUseForecastingTools(user);
  const lockReason = getForecastingLockReason(user);
  const fin = useOverviewFinancialAggregates();
  const [narrowLayout, setNarrowLayout] = useState(false);
  const [horizon, setHorizon] = useState(3);
  const [forecastState, setForecastState] = useState({
    loading: true,
    error: null,
    data: null,
  });
  const [fullSeriesState, setFullSeriesState] = useState({
    loading: true,
    error: null,
    records: [],
  });

  useEffect(() => {
    if (!canForecast) {
      setForecastState({ loading: false, error: null, data: null });
      return () => {};
    }
    let active = true;
    setForecastState((prev) => ({ ...prev, loading: true, error: null }));
    forecastApi.cashFlow({ horizon, period: 'monthly' })
      .then((data) => {
        if (!active) return;
        setForecastState({ loading: false, error: null, data });
      })
      .catch((err) => {
        if (!active) return;
        setForecastState({
          loading: false,
          error: err?.message || 'Failed to load forecast',
          data: null,
        });
      });
    return () => {
      active = false;
    };
  }, [horizon, canForecast]);

  useEffect(() => {
    if (!canForecast) {
      setFullSeriesState({ loading: false, error: null, records: [] });
      return () => {};
    }
    let active = true;
    setFullSeriesState((prev) => ({ ...prev, loading: true, error: null }));
    getFinancialData({ period: 'monthly' })
      .then(({ data }) => {
        if (!active) return;
        setFullSeriesState({
          loading: false,
          error: null,
          records: data?.records ?? [],
        });
      })
      .catch((err) => {
        if (!active) return;
        setFullSeriesState({
          loading: false,
          error: err?.message || 'Failed to load historical series',
          records: [],
        });
      });
    return () => {
      active = false;
    };
  }, [canForecast]);

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

  const fullHistoricalSeries = useMemo(() => {
    const records = fullSeriesState.records || [];
    if (!records.length) return [];
    return records.map((r) => ({
      period: r.period,
      historicalCashFlow: Number(r.total_revenue) - Number(r.total_expenses),
    }));
  }, [fullSeriesState.records]);

  /** Merged once from full history + API predictions (anchor after true last month). */
  const mergedChartRows = useMemo(() => {
    const rows = fullHistoricalSeries.map((item) => ({
      period: item.period,
      historicalCashFlow: item.historicalCashFlow,
      predictedCashFlow: null,
    }));
    const predictions = forecastState.data?.predictions ?? [];
    if (!predictions.length) return rows;

    const predictedSeries = predictions.map((prediction) => ({
      period: prediction.periodLabel,
      historicalCashFlow: null,
      predictedCashFlow: Number(prediction.predictedCashFlow ?? 0),
    }));

    // Align forecast series with chart history: overview monthly labels can extend one month past
    // the model's last period (e.g. history ends 2026-04 while the forecast series ends 2026-03).
    // Then the API's first prediction is 2026-04, the same period as the last chart row. We must merge
    // that prediction into the last row instead of dropping it (dropping hid the first 30-day month).
    const mergedRows = rows.map((r) => ({ ...r }));
    let extraPreds = predictedSeries;

    if (mergedRows.length > 0 && extraPreds.length > 0) {
      const lastIdx = mergedRows.length - 1;
      const lastPeriod = mergedRows[lastIdx].period;
      const firstPred = extraPreds[0];

      if (firstPred.period === lastPeriod) {
        mergedRows[lastIdx] = {
          ...mergedRows[lastIdx],
          predictedCashFlow: Number(firstPred.predictedCashFlow ?? 0),
        };
        extraPreds = extraPreds.slice(1);
      } else {
        const handoff = Number(mergedRows[lastIdx].historicalCashFlow ?? 0);
        mergedRows[lastIdx] = {
          ...mergedRows[lastIdx],
          predictedCashFlow: handoff,
        };
      }
    }

    return [...mergedRows, ...extraPreds];
  }, [fullHistoricalSeries, forecastState.data]);

  const displayChartRows = useMemo(
    () => filterForecastChartRowsByDateRange(mergedChartRows, fin.startDate, fin.endDate),
    [mergedChartRows, fin.startDate, fin.endDate]
  );

  const recentHistoricalCashFlows = useMemo(
    () =>
      fullHistoricalSeries
        .map((item) => Number(item.historicalCashFlow))
        .filter((v) => Number.isFinite(v))
        .slice(-6),
    [fullHistoricalSeries]
  );

  const forecastBaselineCashFlow = useMemo(() => {
    if (!recentHistoricalCashFlows.length) return 0;
    const sorted = [...recentHistoricalCashFlows].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }, [recentHistoricalCashFlows]);

  const hasChartData =
    displayChartRows.length > 0 &&
    (displayChartRows.some((row) => row.historicalCashFlow != null) ||
      displayChartRows.some((row) => row.predictedCashFlow != null));

  const displayShowsPredicted = useMemo(
    () =>
      displayChartRows.some(
        (row) => row.predictedCashFlow != null && Number.isFinite(Number(row.predictedCashFlow))
      ),
    [displayChartRows]
  );

  const shortTerm = forecastState.data?.shortTermForecasts;
  const forecast30 = shortTerm?.day30?.predictedCashFlow ?? 0;
  const forecast60 = shortTerm?.day60?.predictedCashFlow ?? 0;
  const forecast90 = shortTerm?.day90?.predictedCashFlow ?? 0;
  const accuracy = forecastState.data?.accuracyMetrics;

  const chartLoading = forecastState.loading || fullSeriesState.loading;
  const chartError = forecastState.error || fullSeriesState.error;
  const loading = chartLoading || fin.loading;
  const error = chartError || fin.error;

  const accuracyMapeTone = useMemo(
    () => getForecastAccuracyMapeTone(accuracy?.MAPE),
    [accuracy?.MAPE]
  );
  const accuracyGridToneClass =
    accuracyMapeTone === 'good'
      ? styles.forecastAccuracyMapeGood
      : accuracyMapeTone === 'warn'
        ? styles.forecastAccuracyMapeWarn
        : accuracyMapeTone === 'bad'
          ? styles.forecastAccuracyMapeBad
          : '';

  if (!canForecast) {
    return (
      <motion.div
        className={styles.page}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Forecasting</h1>
        </header>
        <div className={styles.forecastingLockedPanel} role="status">
          <h2 className={styles.forecastingLockedTitle}>Forecasting is locked</h2>
          <p className={styles.forecastingLockedText}>
            {lockReason === 'admin' ?
              'Forecasting tools have been disabled for your account by an administrator. Effective immediately, all model-based forecasting is turned off. Other areas of PredictIQ continue to show historical data only.'
            : 'You have withdrawn consent for PredictIQ to process your financial data for forecasting. Effective immediately, all forecasting tools are turned off. Charts and reports show historical figures only; trend projections and model forecasts are unavailable until consent and access are restored.'}
          </p>
          <p className={styles.forecastingLockedHint}>
            You can review or change consent under Settings → Data & uploads. If an administrator disabled
            forecasting for your organisation, they must restore access before these tools return.
          </p>
          <div className={styles.forecastingLockedCtaWrap}>
            <Link to="/settings/data-uploads" className={styles.forecastDownloadBtn}>
              Open Data & uploads in Settings
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  const modelAccuracyCard = (
    <SummaryCard
      title="Model Accuracy"
      variant={narrowLayout ? 'forecastingMobileStrip' : 'default'}
      className={narrowLayout ? styles.forecastAccuracyMobileBelow : ''}
    >
      <div className={`${styles.forecastAccuracyGrid} ${accuracyGridToneClass}`.trim()}>
        <div className={styles.forecastAccuracyItem}>
          <span className={styles.forecastAccuracyLabel}>MAE</span>
          <span className={styles.forecastAccuracyValue}>
            {accuracy?.MAE != null ? formatGbpCompact(accuracy.MAE) : '-'}
          </span>
          <span className={styles.forecastMuted}>Average amount predictions are off by</span>
        </div>
        <div className={styles.forecastAccuracyItem}>
          <span className={styles.forecastAccuracyLabel}>RMSE</span>
          <span className={styles.forecastAccuracyValue}>
            {accuracy?.RMSE != null ? formatGbpCompact(accuracy.RMSE) : '-'}
          </span>
          <span className={styles.forecastMuted}>Error measure that penalises large mistakes</span>
        </div>
        <div className={styles.forecastAccuracyItem}>
          <span className={styles.forecastAccuracyLabel}>MAPE</span>
          <span className={styles.forecastAccuracyValue}>
            {accuracy?.MAPE != null ? formatPercentPoints(accuracy.MAPE, 2) : 'Insufficient data'}
          </span>
          <span className={styles.forecastMuted}>Average percentage error across predictions</span>
        </div>
      </div>
    </SummaryCard>
  );

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Forecasting</h1>
      </header>
      <div
        className={`${styles.layoutStack} ${narrowLayout ? styles.forecastingPageMobile : ''}`.trim()}
      >
        <div className={styles.rowTwoColumn}>
          <SummaryCard
            title={narrowLayout ? '' : 'Forecast KPI Cards'}
            variant={narrowLayout ? 'forecastingMobileStrip' : 'default'}
          >
            {!narrowLayout && (
              <p className={styles.forecastMuted} style={{ marginBottom: '0.75rem' }}>
                These cards show predicted monthly net cash flow (revenue minus expenses) for the next
                30, 60 and 90 days, color-coded against your recent business baseline.
              </p>
            )}
            <ForecastSummaryWidget
              forecast30={forecast30}
              forecast60={forecast60}
              forecast90={forecast90}
              baselineCashFlow={forecastBaselineCashFlow}
              recentCashFlows={recentHistoricalCashFlows}
              layout={narrowLayout ? 'kpiList' : 'grid'}
            />
          </SummaryCard>
          {!narrowLayout && modelAccuracyCard}
        </div>

        <div
          className={`${styles.rowFullTall} ${
            narrowLayout ? chartLayoutStyles.chartSectionFullBleed : ''
          }`.trim()}
        >
          <ChartCard
            className={narrowLayout ? '' : styles.fullWidthTallCard}
            flatLayout={narrowLayout}
            title={narrowLayout ? '' : 'Forecast vs Historical Chart'}
            subtitle={
              narrowLayout ?
                ''
              : 'The chart merges your full monthly history with the model’s predicted path starting after your latest month. The date range only zooms which months are shown; forecast months appear when your range includes them.'
            }
            loading={loading}
            error={error}
            hasData={hasChartData}
            filtersBarGapPx={narrowLayout ? 6 : 10}
            filtersBar={
              <FilterBar
                startDate={fin.startDate}
                onStartDateChange={fin.setStartDate}
                endDate={fin.endDate}
                onEndDateChange={fin.setEndDate}
                onReset={fin.resetFilters}
                idPrefix="forecast-vs-historical-filter"
              />
            }
            showProjectionControls={displayShowsPredicted}
            projectionMonths={horizon}
            onProjectionChange={setHorizon}
          >
            <div
              className={narrowLayout ? chartLayoutStyles.chartPlot : undefined}
              style={narrowLayout ? undefined : { width: '100%', height: 320 }}
            >
              <ForecastVsHistoricalChart chartRows={displayChartRows} />
            </div>
          </ChartCard>
        </div>
        {narrowLayout && modelAccuracyCard}
      </div>
    </motion.div>
  );
}
