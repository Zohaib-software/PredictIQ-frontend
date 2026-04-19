import { motion } from 'framer-motion';
import { useFinancialRecords, EMPTY_FINANCIAL_CHART_MESSAGE } from '../../context/FinancialRecordsContext';
import { TrendProjectionControls } from './TrendProjectionControls';
import styles from './ChartCard.module.css';

export function ChartCard({
  title,
  subtitle,
  children,
  loading,
  error,
  hasData = true,
  className = '',
  actions = null,
  /** Optional toolbar (e.g. date filters) shown under the title when the card is active */
  filtersBar = null,
  /** Extra space (px) between the filters row and the chart body */
  filtersBarGapPx = 10,
  showProjectionControls = false,
  projectionMonths = 1,
  onProjectionChange = null,
}) {
  const { loadingRecords, hasFinancialRecords } = useFinancialRecords();
  // Global no-records state must always prevent chart rendering.
  const showNoRecords = !loadingRecords && hasFinancialRecords === false;
  const showChartNoData =
    !showNoRecords && !loadingRecords && !loading && !error && !hasData;
  const showTrendFooter =
    showProjectionControls && hasFinancialRecords && hasData && onProjectionChange;

  return (
    <motion.article
      className={`${styles.card} ${className}`.trim()}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {(title || subtitle || (actions && !showNoRecords)) && (
        <div className={styles.headerRow}>
          {(title || subtitle) && (
            <div className={styles.titleColumn}>
              {title && <h3 className={styles.title}>{title}</h3>}
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>
          )}
          {actions && !showNoRecords && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      {filtersBar && !showNoRecords && (
        <div
          className={styles.cardFiltersBar}
          style={filtersBarGapPx > 0 ? { marginBottom: filtersBarGapPx } : undefined}
        >
          {filtersBar}
        </div>
      )}
      {showNoRecords && (
        <div className={styles.empty} role="status">
          <p>{EMPTY_FINANCIAL_CHART_MESSAGE}</p>
        </div>
      )}
      {!showNoRecords && (loadingRecords || loading) && (
        <div className={styles.empty} role="status">
          <p>{EMPTY_FINANCIAL_CHART_MESSAGE}</p>
        </div>
      )}
      {!showNoRecords && !loadingRecords && !loading && error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {showChartNoData && (
        <div className={styles.empty} role="status">
          <p>{EMPTY_FINANCIAL_CHART_MESSAGE}</p>
        </div>
      )}
      {!showNoRecords && !loadingRecords && !loading && !error && hasData &&
        (showTrendFooter ? (
          <div className={styles.chartColumn}>
            <div className={styles.chartPlotArea}>
              {children ?? (
                <div className={styles.empty} role="status">
                  <p>{EMPTY_FINANCIAL_CHART_MESSAGE}</p>
                </div>
              )}
            </div>
            <div className={styles.projectionAnchor}>
              <TrendProjectionControls value={projectionMonths} onChange={onProjectionChange} />
            </div>
          </div>
        ) : (
          children ?? (
            <div className={styles.empty} role="status">
              <p>{EMPTY_FINANCIAL_CHART_MESSAGE}</p>
            </div>
          )
        ))}
    </motion.article>
  );
}
