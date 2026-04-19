import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { forecastApi } from '../../api/forecastApi';
import { useChart } from '../../hooks/useChart';
import { SummaryCard, ForecastSummaryWidget } from '../../components/dashboard/SummaryCard';
import { FinancialPerformanceSection } from '../../components/dashboard/FinancialPerformanceSection';
import { useOverviewFinancialAggregates } from '../../hooks/useOverviewFinancialAggregates';
import { useFinancialRecords, EMPTY_FINANCIAL_CHART_MESSAGE } from '../../context/FinancialRecordsContext';
import styles from './DashboardPages.module.css';

export function OverviewPage() {
  const { hasFinancialRecords, loadingRecords } = useFinancialRecords();
  const fin = useOverviewFinancialAggregates();
  const forecastFetcher = useMemo(
    () => () => forecastApi.cashFlow({ horizon: 6, period: 'monthly' }),
    []
  );
  const forecast = useChart(forecastFetcher);

  const historicalSeries = useMemo(() => {
    const records = fin.chartData?.records || [];
    if (!records.length) return [];
    return records.map((r) => ({
      period: r.period,
      historicalCashFlow: Number(r.total_revenue) - Number(r.total_expenses),
    }));
  }, [fin.chartData]);

  const recentHistoricalCashFlows = useMemo(
    () =>
      historicalSeries
        .map((item) => Number(item.historicalCashFlow))
        .filter((v) => Number.isFinite(v))
        .slice(-6),
    [historicalSeries]
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

  const st = forecast.data?.shortTermForecasts;
  const forecast30 = st?.day30?.predictedCashFlow ?? 0;
  const forecast60 = st?.day60?.predictedCashFlow ?? 0;
  const forecast90 = st?.day90?.predictedCashFlow ?? 0;
  const canDownloadForecastReport = !forecast.loading && !forecast.error && hasFinancialRecords && forecast.data;

  const handleDownloadForecastReport = () => {
    if (!canDownloadForecastReport) return;
    const generatedAt = new Date();
    const generatedDate = generatedAt.toISOString().slice(0, 10);
    const rows = [
      ['Section', 'Metric', 'Value'],
      ['Short Term Forecast', 'Day 30', forecast30],
      ['Short Term Forecast', 'Day 60', forecast60],
      ['Short Term Forecast', 'Day 90', forecast90],
      ['Report', 'Generated Date', generatedAt.toISOString()],
    ];

    const csv = rows
      .map((row) => row.map((field) => `"${String(field).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `predictiq-forecast-report-${generatedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Overview</h1>
        <p className={styles.pageSubtitle}>Key performance indicators at a glance</p>
      </header>

      <FinancialPerformanceSection
        startDate={fin.startDate}
        setStartDate={fin.setStartDate}
        endDate={fin.endDate}
        setEndDate={fin.setEndDate}
        onResetFilters={fin.resetFilters}
        chartData={fin.chartData}
        summary={fin.summary}
        loading={fin.loading}
        error={fin.error}
        onRetry={fin.retry}
      />

      <div className={styles.layoutStack}>
        <div className={styles.rowFull}>
          <SummaryCard title="Cash Flow Forecast">
            {forecast.loading && (
              <p className={styles.forecastMuted}>Loading forecast…</p>
            )}
            {forecast.error && (
              <p className={styles.forecastError}>{forecast.error}</p>
            )}
            {!forecast.loading && !forecast.error && !loadingRecords && !hasFinancialRecords && (
              <p className={styles.forecastMuted}>{EMPTY_FINANCIAL_CHART_MESSAGE}</p>
            )}
            {!forecast.loading && !forecast.error && hasFinancialRecords && forecast.data && (
              <>
                <ForecastSummaryWidget
                  forecast30={forecast30}
                  forecast60={forecast60}
                  forecast90={forecast90}
                  baselineCashFlow={forecastBaselineCashFlow}
                  recentCashFlows={recentHistoricalCashFlows}
                />
                <div className={styles.forecastDownloadWrap}>
                  <button
                    type="button"
                    className={`${styles.forecastDownloadBtn} ${styles.forecastDownloadBtnSubtle}`}
                    onClick={handleDownloadForecastReport}
                  >
                    Download Forecast Report
                  </button>
                </div>
              </>
            )}
          </SummaryCard>
        </div>
      </div>
    </motion.div>
  );
}
