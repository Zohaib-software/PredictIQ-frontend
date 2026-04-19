import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  DefaultTooltipContent,
} from 'recharts';
import { getFinancialData } from '../../api/dataApi';
import { useFinancialRecords, EMPTY_FINANCIAL_CHART_MESSAGE } from '../../context/FinancialRecordsContext';
import { useReducedMotionSetting } from '../../context/ReducedMotionContext';
import { DataChartProjectionFooter } from './DataChartProjectionFooter';
import { ChartNarration } from './ChartNarration';
import { FilterBar } from './FilterBar';
import styles from '../../pages/dashboard/DataPage.module.css';
import { paddedNumericDomain } from '../../utils/chartAxisDomain';
import { filterForecastChartRowsByDateRange } from '../../utils/forecastChartDisplay';
import {
  formatChartAxisGBP,
  formatGbp,
  formatGbpCompact,
  formatGbpFull,
  formatPercentPoints,
} from '../../utils/displayFormat';
import { getFuturePeriodLabels, projectForwardIndices } from '../../utils/seriesProjection';
import { chartProjectionStroke } from '../../theme';
import { useLegendToggleGroups } from '../../hooks/useLegendToggleGroups';
import {
  filterTooltipPayloadPreferActualOverProjection,
  legendEntryDimmed,
  projectedLineHidden,
} from '../../utils/chartLegendVisibility';

const STORAGE_DATA_PROJECTION_STEPS = 'predictiq_data_chart_projection_horizon_steps';

const DATA_CHART_LEGEND_GROUPS = {
  revenue: ['revenue'],
  revProj: ['revProj'],
  expenses: ['expenses'],
  expProj: ['expProj'],
  grossProfit: ['grossProfit'],
  gpProj: ['gpProj'],
};

const DATA_CHART_ACTUAL_PROJ_PAIRS = [
  { actual: 'revenue', projected: 'revProj' },
  { actual: 'expenses', projected: 'expProj' },
  { actual: 'grossProfit', projected: 'gpProj' },
];

function projectionBucketsForPeriod(period, steps) {
  if (period === 'daily') return steps * 30; // 30/60/90-day horizon
  if (period === 'weekly') return steps * 4; // ~28/56/84-day horizon
  if (period === 'monthly') return steps; // 1/2/3 months
  return 0; // Do not project yearly with a 90-day max standard
}

function readDataProjectionSteps() {
  if (typeof window === 'undefined') return 1;
  try {
    const n = Number.parseInt(localStorage.getItem(STORAGE_DATA_PROJECTION_STEPS), 10);
    return [1, 2, 3].includes(n) ? n : 1;
  } catch {
    return 1;
  }
}

function kpiMarginClass(margin) {
  if (margin >= 30) return styles.kpiMarginGreen;
  if (margin >= 15) return styles.kpiMarginAmber;
  return styles.kpiMarginRed;
}

/** API buckets are always monthly for this overview section. */
const CHART_PERIOD = 'monthly';

export function FinancialPerformanceSection({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  onResetFilters,
  chartData,
  summary,
  loading,
  error,
  onRetry,
}) {
  const period = CHART_PERIOD;
  const [kpiView, setKpiView] = useState('average');
  const [dataProjectionSteps, setDataProjectionSteps] = useState(readDataProjectionSteps);
  const [fullSeriesState, setFullSeriesState] = useState({
    loading: true,
    error: null,
    records: [],
  });
  const { hasFinancialRecords, loadingRecords } = useFinancialRecords();
  const { reducedMotionEnabled } = useReducedMotionSetting();
  const chartLineAnim = !reducedMotionEnabled;

  const fetchFullMonthlySeries = useCallback(() => {
    setFullSeriesState((prev) => ({ ...prev, loading: true, error: null }));
    getFinancialData({ period: 'monthly' })
      .then(({ data }) => {
        setFullSeriesState({
          loading: false,
          error: null,
          records: data?.records ?? [],
        });
      })
      .catch((err) => {
        setFullSeriesState({
          loading: false,
          error: err?.message || 'Failed to load full monthly series',
          records: [],
        });
      });
  }, []);

  useEffect(() => {
    fetchFullMonthlySeries();
  }, [fetchFullMonthlySeries]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DATA_PROJECTION_STEPS, String(dataProjectionSteps));
    } catch {
      /* ignore */
    }
  }, [dataProjectionSteps]);

  const { hidden: dataChartLegendHidden, onLegendClick: onDataChartLegendClick } =
    useLegendToggleGroups(DATA_CHART_LEGEND_GROUPS);

  const fullChartSeries = useMemo(
    () =>
      (fullSeriesState.records || []).map((r) => ({
        period: r.period,
        revenue: r.total_revenue,
        expenses: r.total_expenses,
        grossProfit: r.gross_profit,
      })),
    [fullSeriesState.records]
  );

  const { mergedChartRows, showChartProjection } = useMemo(() => {
    const base = fullChartSeries.map((r) => ({
      ...r,
      revProj: null,
      expProj: null,
      gpProj: null,
    }));

    if (!hasFinancialRecords || fullChartSeries.length < 2) {
      return { mergedChartRows: base, showChartProjection: false };
    }

    const projectionBuckets = projectionBucketsForPeriod(period, dataProjectionSteps);
    if (projectionBuckets < 1) {
      return { mergedChartRows: base, showChartProjection: false };
    }

    const lastPeriod = String(fullChartSeries[fullChartSeries.length - 1]?.period ?? '');
    const futureLabels = getFuturePeriodLabels(lastPeriod, period, projectionBuckets);
    if (!futureLabels) {
      return { mergedChartRows: base, showChartProjection: false };
    }

    try {
      const hr = projectForwardIndices(
        fullChartSeries.map((r) => r.revenue),
        projectionBuckets
      );
      const he = projectForwardIndices(
        fullChartSeries.map((r) => r.expenses),
        projectionBuckets
      );
      const hg = projectForwardIndices(
        fullChartSeries.map((r) => r.grossProfit),
        projectionBuckets
      );
      if (hr.length === 0) {
        return { mergedChartRows: base, showChartProjection: false };
      }

      const bridged = base.map((row, i) =>
        i === base.length - 1
          ? { ...row, revProj: row.revenue, expProj: row.expenses, gpProj: row.grossProfit }
          : row
      );
      const future = hr.map((rv, j) => ({
        period: futureLabels[j],
        revenue: null,
        expenses: null,
        grossProfit: null,
        revProj: rv,
        expProj: he[j],
        gpProj: hg[j],
      }));
      const merged = [...bridged, ...future];
      return { mergedChartRows: merged, showChartProjection: true };
    } catch {
      return { mergedChartRows: base, showChartProjection: false };
    }
  }, [fullChartSeries, dataProjectionSteps, hasFinancialRecords]);

  const chartRowsForPlot = useMemo(
    () => filterForecastChartRowsByDateRange(mergedChartRows, startDate, endDate),
    [mergedChartRows, startDate, endDate]
  );

  const chartYDomain = useMemo(() => {
    if (!chartRowsForPlot.length) {
      return paddedNumericDomain([
        fullChartSeries.map((r) => r.revenue),
        fullChartSeries.map((r) => r.expenses),
        fullChartSeries.map((r) => r.grossProfit),
      ]);
    }
    return paddedNumericDomain([
      chartRowsForPlot.map((r) => r.revenue),
      chartRowsForPlot.map((r) => r.expenses),
      chartRowsForPlot.map((r) => r.grossProfit),
      chartRowsForPlot.map((r) => r.revProj).filter((v) => v != null),
      chartRowsForPlot.map((r) => r.expProj).filter((v) => v != null),
      chartRowsForPlot.map((r) => r.gpProj).filter((v) => v != null),
    ]);
  }, [chartRowsForPlot, fullChartSeries]);

  const displayHasProjection = useMemo(
    () =>
      chartRowsForPlot.some(
        (r) =>
          (r.revProj != null && Number.isFinite(Number(r.revProj))) ||
          (r.expProj != null && Number.isFinite(Number(r.expProj))) ||
          (r.gpProj != null && Number.isFinite(Number(r.gpProj)))
      ),
    [chartRowsForPlot]
  );

  const showProjectedSeries = showChartProjection && displayHasProjection;

  return (
    <>
      {(error || fullSeriesState.error) && (
        <div className={styles.errorBox}>
          <span>{error || fullSeriesState.error}</span>
          <button
            type="button"
            className={styles.btnRetry}
            onClick={() => {
              onRetry();
              fetchFullMonthlySeries();
            }}
          >
            Retry
          </button>
        </div>
      )}

      {loading && !summary ? (
        <div className={styles.kpiGrid}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      ) : summary && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-secondary-text)' }}>KPI view:</span>
            <button
              type="button"
              onClick={() => setKpiView('average')}
              style={{
                fontSize: '0.85rem',
                padding: '0.25rem 0.5rem',
                background: kpiView === 'average' ? 'var(--color-accent)' : 'transparent',
                color: kpiView === 'average' ? 'var(--color-card-bg)' : 'var(--color-secondary-text)',
                border: '1px solid var(--color-border-light)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
            >
              Average
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-border-light)' }}>|</span>
            <button
              type="button"
              onClick={() => setKpiView('total')}
              style={{
                fontSize: '0.85rem',
                padding: '0.25rem 0.5rem',
                background: kpiView === 'total' ? 'var(--color-accent)' : 'transparent',
                color: kpiView === 'total' ? 'var(--color-card-bg)' : 'var(--color-secondary-text)',
                border: '1px solid var(--color-border-light)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
            >
              Total
            </button>
          </div>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>
                {kpiView === 'total' ? 'Total Revenue' : `Avg ${period.charAt(0).toUpperCase() + period.slice(1)} Revenue`}
              </div>
              <div
                className={styles.kpiValue}
                title={formatGbpFull(
                  kpiView === 'total' ? summary.totalRevenue : (summary.avgRevenuePerPeriod ?? 0)
                )}
              >
                {formatGbpCompact(
                  kpiView === 'total' ? summary.totalRevenue : (summary.avgRevenuePerPeriod ?? 0)
                )}
              </div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>
                {kpiView === 'total' ? 'Total Expenses' : `Avg ${period.charAt(0).toUpperCase() + period.slice(1)} Expenses`}
              </div>
              <div
                className={styles.kpiValue}
                title={formatGbpFull(
                  kpiView === 'total' ? summary.totalExpenses : (summary.avgExpensesPerPeriod ?? 0)
                )}
              >
                {formatGbpCompact(
                  kpiView === 'total' ? summary.totalExpenses : (summary.avgExpensesPerPeriod ?? 0)
                )}
              </div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>
                {kpiView === 'total' ? 'Gross Profit' : `Avg ${period.charAt(0).toUpperCase() + period.slice(1)} Gross Profit`}
              </div>
              <div
                className={styles.kpiValue}
                title={formatGbpFull(
                  kpiView === 'total' ? summary.totalGrossProfit : (summary.avgGrossProfitPerPeriod ?? 0)
                )}
              >
                {formatGbpCompact(
                  kpiView === 'total' ? summary.totalGrossProfit : (summary.avgGrossProfitPerPeriod ?? 0)
                )}
              </div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Avg Profit Margin %</div>
              <div className={`${styles.kpiValue} ${kpiMarginClass(summary.avgProfitMargin ?? 0)}`}>
                {formatPercentPoints(summary.avgProfitMargin ?? 0, 1)}
              </div>
            </div>
          </div>
          {(startDate || endDate) && (
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--color-secondary-text)',
                marginTop: '0.5rem',
                marginBottom: 0,
              }}
            >
              Showing {startDate || '…'} to {endDate || '…'}
            </p>
          )}
        </>
      )}

      <div className={styles.chartSection}>
        <h2 className={styles.chartTitle}>Revenue, Expenses & Gross Profit</h2>
        <p className={styles.chartSubtitle}>
          Projection uses your full monthly history (anchored after the latest month). The date range
          only selects which months are shown on the chart.
        </p>
        <FilterBar
          startDate={startDate}
          onStartDateChange={setStartDate}
          endDate={endDate}
          onEndDateChange={setEndDate}
          onReset={onResetFilters}
          idPrefix="revenue-chart-filter"
        />
        {!loadingRecords && !hasFinancialRecords ? (
          <div className={styles.chartEmpty}>{EMPTY_FINANCIAL_CHART_MESSAGE}</div>
        ) : fullSeriesState.loading && !fullChartSeries.length ? (
          <div className={styles.chartSkeleton} />
        ) : fullChartSeries.length === 0 ? (
          <div className={styles.chartEmpty}>
            No financial data yet. Upload a CSV to see revenue, expenses, and gross profit over time.
          </div>
        ) : chartRowsForPlot.length === 0 ? (
          <div className={styles.chartEmpty}>
            No financial data in the selected date range. Adjust the filters or reset to see the full
            series.
          </div>
        ) : (
          <div className={styles.chartWrap}>
            <div className={styles.chartPlot}>
              {fullSeriesState.loading && !fullChartSeries.length ? (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-card-bg)', opacity: 0.8, zIndex: 1 }}>
                  <span aria-hidden="true">Loading…</span>
                </div>
              ) : null}
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRowsForPlot} margin={{ top: 10, right: 12, left: 4, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
                  <XAxis
                    dataKey="period"
                    stroke="var(--color-secondary-text)"
                    tick={{ fontSize: 12, fill: 'var(--color-secondary-text)' }}
                    minTickGap={28}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="var(--color-secondary-text)"
                    tick={{ fontSize: 13, fill: 'var(--color-secondary-text)' }}
                    tickFormatter={formatChartAxisGBP}
                    tickMargin={8}
                    width={58}
                    domain={chartYDomain}
                  />
                  <Tooltip
                    allowEscapeViewBox={{ x: false, y: false }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <DefaultTooltipContent
                          active={active}
                          payload={filterTooltipPayloadPreferActualOverProjection(
                            payload,
                            DATA_CHART_ACTUAL_PROJ_PAIRS
                          )}
                          label={label}
                          formatter={(value, name) =>
                            value != null ? [formatGbp(value), name] : [null, name]
                          }
                          labelFormatter={(l) => `Period: ${l}`}
                          contentStyle={{
                            background: 'var(--color-card-bg)',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: 8,
                          }}
                        />
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ cursor: 'pointer' }}
                    onClick={onDataChartLegendClick}
                    formatter={(value, entry) => (
                      <span
                        style={{
                          opacity: legendEntryDimmed(
                            dataChartLegendHidden,
                            entry.dataKey,
                            DATA_CHART_ACTUAL_PROJ_PAIRS
                          )
                            ? 0.45
                            : 1,
                        }}
                      >
                        {value}
                      </span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="var(--color-primary, #37C1A5)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={chartLineAnim}
                    hide={dataChartLegendHidden.has('revenue')}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    name="Expenses"
                    stroke="#e74c3c"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={chartLineAnim}
                    hide={dataChartLegendHidden.has('expenses')}
                  />
                  <Line
                    type="monotone"
                    dataKey="grossProfit"
                    name="Gross Profit"
                    stroke="#2ecc71"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={chartLineAnim}
                    hide={dataChartLegendHidden.has('grossProfit')}
                  />
                  {showProjectedSeries ? (
                    <>
                      <Line
                        type="monotone"
                        dataKey="revProj"
                        name="Revenue (projected)"
                        stroke={chartProjectionStroke}
                        strokeWidth={2}
                        strokeDasharray="8 4"
                        dot={false}
                        connectNulls
                        isAnimationActive={chartLineAnim}
                        hide={projectedLineHidden(
                          dataChartLegendHidden,
                          'revenue',
                          'revProj'
                        )}
                      />
                      <Line
                        type="monotone"
                        dataKey="expProj"
                        name="Expenses (projected)"
                        stroke={chartProjectionStroke}
                        strokeWidth={2}
                        strokeDasharray="8 4"
                        dot={false}
                        connectNulls
                        isAnimationActive={chartLineAnim}
                        hide={projectedLineHidden(
                          dataChartLegendHidden,
                          'expenses',
                          'expProj'
                        )}
                      />
                      <Line
                        type="monotone"
                        dataKey="gpProj"
                        name="Gross profit (projected)"
                        stroke={chartProjectionStroke}
                        strokeWidth={2}
                        strokeDasharray="8 4"
                        dot={false}
                        connectNulls
                        isAnimationActive={chartLineAnim}
                        hide={projectedLineHidden(
                          dataChartLegendHidden,
                          'grossProfit',
                          'gpProj'
                        )}
                      />
                    </>
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {hasFinancialRecords ? (
              <>
                {showProjectedSeries ? (
                  <DataChartProjectionFooter
                    period={period}
                    steps={dataProjectionSteps}
                    onStepsChange={setDataProjectionSteps}
                  />
                ) : null}
                <ChartNarration
                  summary={summary}
                  chartData={chartData}
                  startDate={startDate}
                  endDate={endDate}
                />
              </>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
