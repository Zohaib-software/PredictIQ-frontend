import { useState, useEffect, useRef, useCallback } from 'react';
import styles from '../../pages/dashboard/DataPage.module.css';

const RESET_SUCCESS_MS = 1000;

/**
 * Shared date range + reset filter bar used across dashboard pages.
 */
export function FilterBar({
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  onReset,
  idPrefix,
  variant = 'default',
  extraContent = null,
}) {
  const [resetSuccess, setResetSuccess] = useState(false);
  const resetTimerRef = useRef(null);

  useEffect(
    () => () => {
      if (resetTimerRef.current != null) {
        window.clearTimeout(resetTimerRef.current);
      }
    },
    []
  );

  const handleResetClick = useCallback(() => {
    onReset();
    setResetSuccess(true);
    if (resetTimerRef.current != null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setResetSuccess(false);
      resetTimerRef.current = null;
    }, RESET_SUCCESS_MS);
  }, [onReset]);

  const startId = `${idPrefix}-start-date`;
  const endId = `${idPrefix}-end-date`;
  const barClassName =
    variant === 'embedded'
      ? `${styles.filtersBar} ${styles.filtersBarEmbedded}`
      : styles.filtersBar;

  return (
    <div className={barClassName}>
      <div className={styles.dateRange}>
        <label className={styles.dateRangeLabel} htmlFor={startId}>
          Start date
        </label>
        <input
          id={startId}
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          aria-label="Chart start date"
        />
      </div>
      <div className={styles.dateRange}>
        <label className={styles.dateRangeLabel} htmlFor={endId}>
          End date
        </label>
        <input
          id={endId}
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          aria-label="Chart end date"
        />
      </div>
      <div className={styles.dateRange}>
        <span className={styles.dateRangeLabel} aria-hidden="true">
          {'\u00a0'}
        </span>
        <button
          type="button"
          className={`${styles.resetFilters} ${resetSuccess ? styles.resetFiltersSuccess : ''}`}
          onClick={handleResetClick}
        >
          <span
            className={`${styles.resetFiltersLabel} ${
              resetSuccess ? styles.resetFiltersLabelHidden : ''
            }`}
          >
            Reset filters
          </span>
          <span
            className={`${styles.resetFiltersTick} ${
              resetSuccess ? styles.resetFiltersTickVisible : ''
            }`}
            aria-hidden="true"
          >
            ✓
          </span>
        </button>
      </div>
      {extraContent ? (
        <div className={styles.filtersBarRightControls}>{extraContent}</div>
      ) : null}
    </div>
  );
}
