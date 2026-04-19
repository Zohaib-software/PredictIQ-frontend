import styles from './ChartCard.module.css';

const HORIZON_OPTIONS = [1, 2, 3];

export function TrendProjectionControls({ value, onChange }) {
  return (
    <div className={styles.projectionFooter} role="group" aria-label="Trend projection for this chart">
      <span className={styles.projectionLabel}>Trend projection</span>
      <div className={styles.projectionHorizon}>
        <span className={styles.projectionMuted}>Horizon</span>
        <div className={styles.projectionSeg} role="group">
          {HORIZON_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              className={`${styles.projectionSegBtn} ${
                value === m ? styles.projectionSegBtnActive : ''
              }`}
              onClick={() => onChange(m)}
              aria-pressed={value === m}
              title={`${m} calendar month${m === 1 ? '' : 's'} ahead (~${m * 30}-day)`}
            >
              {m === 1 ? '30 d' : m === 2 ? '60 d' : '90 d'}
            </button>
          ))}
        </div>
      </div>
      <p className={styles.projectionHint}>
        Applies only to this chart: simple linear trend by calendar month (~30/60/90-day steps).
      </p>
    </div>
  );
}
