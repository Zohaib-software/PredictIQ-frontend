import chartStyles from './ChartCard.module.css';

const STEP_OPTIONS = [1, 2, 3];

/**
 * Trend projection controls for the Data page chart only (does not use ChartProjectionContext).
 */
export function DataChartProjectionFooter({ period, steps, onStepsChange, className = '' }) {
  return (
    <div
      className={`${chartStyles.projectionFooter} ${className}`.trim()}
      role="group"
      aria-label="Trend projection for this chart"
    >
      <span className={chartStyles.projectionLabel}>Trend projection</span>
      <div className={chartStyles.projectionHorizon}>
        <span className={chartStyles.projectionMuted}>Horizon</span>
        <div className={chartStyles.projectionSeg} role="group">
          {STEP_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`${chartStyles.projectionSegBtn} ${
                steps === n ? chartStyles.projectionSegBtnActive : ''
              }`}
              onClick={() => onStepsChange(n)}
              aria-pressed={steps === n}
              title={`${n * 30} days ahead`}
            >
              {n === 1 ? '30 d' : n === 2 ? '60 d' : '90 d'}
            </button>
          ))}
        </div>
      </div>
      <p className={chartStyles.projectionHint}>
        Applies only to this chart: fixed linear projection at 30/60/90-day horizons (max 90 days).
      </p>
    </div>
  );
}
