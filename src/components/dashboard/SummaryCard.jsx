import { motion } from 'framer-motion';
import { formatGbpCompact, formatGbpFull } from '../../utils/displayFormat';
import styles from './SummaryCard.module.css';

export function SummaryCard({ title, children, variant = 'default', className = '' }) {
  return (
    <motion.article
      className={`${styles.card} ${styles[variant]} ${className}`.trim()}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {title && <h3 className={styles.title}>{title}</h3>}
      <div className={styles.content}>{children}</div>
    </motion.article>
  );
}

function getMedian(values = []) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function getForecastTone(value, baseline) {
  const numericValue = Number(value ?? 0);
  if (numericValue < 0) return 'negative';

  const scale = Number.isFinite(baseline) ? Math.abs(Number(baseline)) : 0;
  if (scale <= 0) {
    return numericValue > 0 ? 'positive' : 'amber';
  }

  if (numericValue >= scale * 1.1) return 'positive';
  if (numericValue >= scale * 0.9) return 'amber';
  return 'amber';
}

export function ForecastSummaryWidget({
  forecast30 = 0,
  forecast60 = 0,
  forecast90 = 0,
  baselineCashFlow = null,
  recentCashFlows = [],
  /** When `kpiList`, mobile/small screens use the same flat list treatment as overview KPI rows. */
  layout = 'grid',
}) {
  const fmt = (v) => formatGbpCompact(v ?? 0);
  const derivedBaseline =
    Number.isFinite(Number(baselineCashFlow)) && Math.abs(Number(baselineCashFlow)) > 0
      ? Number(baselineCashFlow)
      : getMedian((recentCashFlows || []).map((v) => Number(v)).filter((v) => Number.isFinite(v)));
  const rowClass = (v) => {
    const tone = getForecastTone(v, derivedBaseline);
    if (tone === 'negative') return `${styles.forecastValue} ${styles.forecastNegative}`;
    if (tone === 'positive') return `${styles.forecastValue} ${styles.forecastPositive}`;
    return `${styles.forecastValue} ${styles.forecastAmber}`;
  };
  const gridClassName =
    layout === 'kpiList' ? `${styles.forecastGrid} ${styles.forecastGridKpiList}` : styles.forecastGrid;

  return (
    <div className={gridClassName}>
      <div className={styles.forecastItem}>
        <span className={styles.forecastLabel}>30-Day Forecast</span>
        <span className={rowClass(forecast30)} title={formatGbpFull(forecast30)}>
          {fmt(forecast30)}
        </span>
      </div>
      <div className={styles.forecastItem}>
        <span className={styles.forecastLabel}>60-Day Forecast</span>
        <span className={rowClass(forecast60)} title={formatGbpFull(forecast60)}>
          {fmt(forecast60)}
        </span>
      </div>
      <div className={styles.forecastItem}>
        <span className={styles.forecastLabel}>90-Day Forecast</span>
        <span className={rowClass(forecast90)} title={formatGbpFull(forecast90)}>
          {fmt(forecast90)}
        </span>
      </div>
    </div>
  );
}

export function QuickInsightsSummary({ items = [] }) {
  return (
    <ul className={styles.insightsList} role="list">
      {items.length === 0 ? (
        <li className={styles.insightPlaceholder}>Add data to see insights</li>
      ) : (
        items.map((text, i) => (
          <li key={i} className={styles.insightItem}>{text}</li>
        ))
      )}
    </ul>
  );
}
