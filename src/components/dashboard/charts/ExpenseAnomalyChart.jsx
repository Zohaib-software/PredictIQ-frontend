import { useEffect, useMemo, useState } from 'react';
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
import { useFinancialRecords } from '../../../context/FinancialRecordsContext';
import { useReducedMotionSetting } from '../../../context/ReducedMotionContext';
import { useLegendToggleGroups } from '../../../hooks/useLegendToggleGroups';
import { projectedLineHidden, tooltipDatumHasActualValue } from '../../../utils/chartLegendVisibility';
import {
  StructuredChartLegend,
  structuredLegendChartBottom,
  structuredLegendWrapperStyle,
} from '../StructuredChartLegend';
import { chartColors, chartProjectionStroke } from '../../../theme';
import { paddedNumericDomain } from '../../../utils/chartAxisDomain';
import { formatChartAxisGBP, formatGbp } from '../../../utils/displayFormat';
import { addMonthsToPeriodLabel, projectForwardIndices } from '../../../utils/seriesProjection';
import { filterForecastChartRowsByDateRange } from '../../../utils/forecastChartDisplay';
import { AnomalyAnnotationModal } from '../../common/AnomalyAnnotationModal';
import styles from './ExpenseAnomalyChart.module.css';

/** Month-over-month slope from last two in-sample trend points (matches global OLS line on chart). */
function trendMonthlyIncrement(baseRows) {
  const m = baseRows.length;
  if (m < 2) return null;
  const t1 = baseRows[m - 2].trend;
  const t2 = baseRows[m - 1].trend;
  if (t1 == null || t2 == null) return null;
  return t2 - t1;
}

const EXPENSE_ANOMALY_LEGEND_GROUPS = {
  total_expenses: ['total_expenses'],
  trend: ['trend'],
  expProj: ['expProj'],
  /** Invisible series: toggles orange/green anomaly markers on the Total expenses line. */
  anomalyMarkers: ['anomalyMarkers'],
};

const EXPENSE_ANOMALY_ACTUAL_PROJ_PAIRS = [{ actual: 'total_expenses', projected: 'expProj' }];

const EXPENSE_ANOMALY_LEGEND_SHORT_LABELS = {
  expProj: 'Proj.',
};

const EXPENSE_ANOMALY_DASHED_SWATCH_KEYS = new Set(['trend', 'expProj']);

/** Matches backend anomaly band styling (amber). */
const THRESHOLD_LINE_STROKE = '#f59e0b';
const THRESHOLD_LINE_DASH = '4 4';
const UPPER_BAND_KEY = 'upperBandValue';
const LOWER_BAND_KEY = 'lowerBandValue';

const ANOMALY_UNVERIFIED_FILL = '#f97316';
const ANOMALY_UNVERIFIED_STROKE = '#c2410c';
const ANOMALY_VERIFIED_FILL = '#22c55e';
const ANOMALY_VERIFIED_STROKE = '#15803d';

const BAND_NAMES_TOOLTIP_FILTER = new Set(['Upper band', 'Lower band']);

/** Same panel styling as overview / forecasting line chart tooltips. */
const EXPENSE_ANOMALY_TOOLTIP_CONTENT_STYLE = {
  background: 'var(--color-card-bg)',
  border: '1px solid var(--color-border-light)',
  borderRadius: 8,
};

function filterExpenseAnomalyTooltipPayload(payload, row) {
  if (!Array.isArray(payload)) return [];
  return payload
    .filter((p) => !BAND_NAMES_TOOLTIP_FILTER.has(p.name))
    .filter((p) => p.dataKey !== 'anomalyMarkers')
    .filter(
      (p) =>
        !(
          p.dataKey === 'expProj' &&
          tooltipDatumHasActualValue(row, 'total_expenses')
        )
    );
}

function hasAnomalyNote(row) {
  const n = row?.notes;
  return n != null && String(n).trim() !== '';
}

function ExpenseTotalDot({ cx, cy, payload, highlightPeriod, onAnomalyClick, markersHidden }) {
  if (cx == null || cy == null) return null;
  const isAnomaly = payload?.isAnomaly === true;
  const isHighlighted =
    isAnomaly && highlightPeriod && payload?.period === highlightPeriod;
  const verified = isAnomaly && hasAnomalyNote(payload);
  const showPulseRing = isAnomaly && !verified;

  if (isAnomaly && markersHidden) {
    return <circle cx={cx} cy={cy} r={3} fill={chartColors[0]} />;
  }

  if (isAnomaly) {
    const handleActivate = (e) => {
      e.stopPropagation();
      if (payload?.recordId) onAnomalyClick?.(payload);
    };
    const fill = verified ? ANOMALY_VERIFIED_FILL : ANOMALY_UNVERIFIED_FILL;
    const stroke = verified ? ANOMALY_VERIFIED_STROKE : ANOMALY_UNVERIFIED_STROKE;
    const ringStroke = verified ? '#4ade80' : '#fb923c';
    return (
      <g style={{ cursor: payload?.recordId ? 'pointer' : 'default' }} onClick={handleActivate}>
        {payload?.recordId ? (
          <title>
            {verified ?
              `Verified anomaly: ${payload.period} (click to edit)`
            : `Explain anomaly: ${payload.period} (click)`}
          </title>
        ) : null}
        {showPulseRing && (
          <circle
            cx={cx}
            cy={cy}
            r={8}
            fill="none"
            stroke={ringStroke}
            strokeWidth={isHighlighted ? 2.75 : 2}
            opacity={isHighlighted ? 0.7 : 0.55}
          >
            <animate attributeName="r" values="8;14;8" dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.65;0.2;0.65" dur="1.4s" repeatCount="indefinite" />
          </circle>
        )}
        <circle
          cx={cx}
          cy={cy}
          r={showPulseRing ? 7 : 5}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.5}
          pointerEvents="none"
        />
        <circle cx={cx} cy={cy} r={16} fill="transparent" stroke="none" pointerEvents="all" />
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={3} fill={chartColors[0]} />;
}

const TOOLTIP_HOVER_GRACE_MS = 280;

function ExpenseAnomalyTooltip({ active, payload, label }) {
  const [hoveringPanel, setHoveringPanel] = useState(false);
  const [stalePayload, setStalePayload] = useState(null);
  /** Snapshot taken when pointer enters the tooltip; Recharts keeps changing payload as x moves. */
  const [panelLockedPayload, setPanelLockedPayload] = useState(null);

  useEffect(() => {
    if (hoveringPanel) return;
    if (active && payload?.length) {
      setStalePayload(payload);
    }
  }, [active, payload, hoveringPanel]);

  useEffect(() => {
    if (!active && !hoveringPanel) {
      const t = setTimeout(() => setStalePayload(null), TOOLTIP_HOVER_GRACE_MS);
      return () => clearTimeout(t);
    }
  }, [active, hoveringPanel]);

  const displayPayload =
    hoveringPanel && panelLockedPayload?.length ?
      panelLockedPayload
    : (active && payload?.length ? payload : stalePayload);
  if (!displayPayload?.length) return null;

  const row = displayPayload[0].payload;
  const isAnomaly = row.isAnomaly === true;
  const note = row.notes;
  const hasNote = hasAnomalyNote(row);

  const filteredPayload = filterExpenseAnomalyTooltipPayload(displayPayload, row);

  return (
    <div
      className={styles.tooltipCardWrap}
      style={EXPENSE_ANOMALY_TOOLTIP_CONTENT_STYLE}
      onMouseEnter={() => {
        const snap = active && payload?.length ? payload : stalePayload;
        if (snap?.length) setPanelLockedPayload(snap);
        setHoveringPanel(true);
      }}
      onMouseLeave={() => {
        setHoveringPanel(false);
        setPanelLockedPayload(null);
      }}
    >
      <DefaultTooltipContent
        active={active}
        payload={filteredPayload}
        label={label}
        formatter={(value, name) =>
          value != null ? [formatGbp(value), name] : [null, name]
        }
        labelFormatter={(l) => `Period: ${l ?? row?.period ?? ''}`}
        contentStyle={{
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
        }}
        labelStyle={{ color: 'var(--color-secondary-text)', fontWeight: 600 }}
      />
      {isAnomaly && hasNote && (
        <div className={styles.tooltipNoteBelow}>
          <p className={styles.noteText}>{String(note).trim()}</p>
        </div>
      )}
    </div>
  );
}

export function ExpenseAnomalyChart({
  data,
  projectionMonths = 1,
  highlightPeriod,
  enableProjection = true,
  startDate = '',
  endDate = '',
}) {
  const { reducedMotionEnabled } = useReducedMotionSetting();
  const lineAnim = !reducedMotionEnabled;
  const { hasFinancialRecords } = useFinancialRecords();
  const projectionActive = hasFinancialRecords;
  const { hidden, onLegendClick } = useLegendToggleGroups(EXPENSE_ANOMALY_LEGEND_GROUPS);

  const [notesByPeriod, setNotesByPeriod] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  if (!data?.date?.length) return null;

  const baseRows = data.date.map((d, i) => ({
    period: d,
    total_expenses: data.total_expenses?.[i] ?? 0,
    trend: data.trend?.[i],
    trend_upper: data.upperBand?.[i] ?? data.trend_upper?.[i],
    trend_lower: data.lowerBand?.[i] ?? data.trend_lower?.[i],
    [UPPER_BAND_KEY]: data.upperBand?.[i] ?? data.trend_upper?.[i] ?? null,
    [LOWER_BAND_KEY]: data.lowerBand?.[i] ?? data.trend_lower?.[i] ?? null,
    outlier: data.isAnomaly?.[i] ?? data.outliers?.[i],
    isAnomaly: data.isAnomaly?.[i] ?? data.outliers?.[i],
    notes:
      Object.prototype.hasOwnProperty.call(notesByPeriod, d) ?
        notesByPeriod[d]
      : (data.notes?.[i] ?? null),
    recordId: data.recordId?.[i] ?? null,
    /** Dummy key so the legend can toggle anomaly markers (Line is invisible). */
    anomalyMarkers: null,
    expProj: null,
  }));

  let chartRows = baseRows;
  if (enableProjection && projectionActive && baseRows.length >= 2) {
    const expenses = (data.total_expenses ?? []).map(Number);
    const pred = projectForwardIndices(expenses, projectionMonths);
    if (pred.length > 0) {
      const lastLabel = data.date[data.date.length - 1];
      const slope = trendMonthlyIncrement(baseRows);
      const last = baseRows[baseRows.length - 1];
      const bandUp =
        last.trend != null && last.trend_upper != null ? last.trend_upper - last.trend : null;

      const bridged = baseRows.map((row, i) =>
        i === baseRows.length - 1 ? { ...row, expProj: row.total_expenses } : row
      );

      const future = pred.map((v, j) => {
        const monthsAhead = j + 1;
        let trendExt = null;
        let upperExt = null;
        let lowerExt = null;
        if (slope != null && last.trend != null) {
          trendExt = Math.round((last.trend + slope * monthsAhead) * 100) / 100;
          if (bandUp != null) {
            upperExt = Math.round((trendExt + bandUp) * 100) / 100;
            lowerExt = Math.round((trendExt - bandUp) * 100) / 100;
          }
        }
        return {
          period: addMonthsToPeriodLabel(lastLabel, monthsAhead),
          total_expenses: null,
          trend: trendExt,
          trend_upper: upperExt,
          trend_lower: lowerExt,
          [UPPER_BAND_KEY]: upperExt,
          [LOWER_BAND_KEY]: lowerExt,
          outlier: false,
          isAnomaly: false,
          notes: null,
          recordId: null,
          anomalyMarkers: null,
          expProj: v,
        };
      });
      chartRows = [...bridged, ...future];
    }
  }

  const displayRows = filterForecastChartRowsByDateRange(chartRows, startDate, endDate);

  if (!displayRows.length) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-secondary-text)', fontSize: 14 }}>
        No expense anomaly data in the selected date range. Adjust the filters or reset.
      </div>
    );
  }

  const handleOpenAnnotate = (row) => {
    if (!row?.recordId) return;
    const raw = row.notes;
    const existing =
      raw != null && String(raw).trim() !== '' ? String(raw).trim() : null;
    setSelectedPeriod({
      periodLabel: row.period,
      recordId: row.recordId,
      existingNote: existing,
    });
    setModalOpen(true);
  };

  const yDomain = paddedNumericDomain(
    [
      displayRows.map((r) => r.total_expenses).filter((v) => v != null),
      displayRows.map((r) => r.trend).filter((v) => v != null),
      displayRows.map((r) => r[UPPER_BAND_KEY]).filter((v) => v != null),
      displayRows.map((r) => r[LOWER_BAND_KEY]).filter((v) => v != null),
      displayRows.map((r) => r.expProj).filter((v) => v != null),
    ].filter((a) => Array.isArray(a) && a.length > 0),
    { padRatio: 0.06 }
  );

  const showProj =
    enableProjection &&
    projectionActive &&
    baseRows.length >= 2 &&
    displayRows.some((r) => r.expProj != null);

  const showLowerBandLine = (data.lowerBand ?? []).some(
    (v) => v != null && Number(v) > 0
  );

  const legendRows = useMemo(
    () =>
      showProj ?
        [['total_expenses', 'trend', 'anomalyMarkers'], ['expProj']]
      : [['total_expenses', 'trend', 'anomalyMarkers']],
    [showProj]
  );
  const legendBottom = useMemo(() => structuredLegendChartBottom(legendRows), [legendRows]);

  return (
    <>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={displayRows} margin={{ top: 10, right: 12, left: 4, bottom: legendBottom }}>
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
            domain={yDomain}
          />
          <Tooltip
            isAnimationActive={false}
            allowEscapeViewBox={{ x: false, y: false }}
            /** `allowEscapeViewBox: true` disables clamping and lets the box leave the chart (Recharts naming). */
            reverseDirection={{ x: false, y: true }}
            offset={18}
            wrapperStyle={{ pointerEvents: 'auto', zIndex: 20 }}
            content={(tipProps) => <ExpenseAnomalyTooltip {...tipProps} />}
          />
          <Legend
            verticalAlign="bottom"
            align="center"
            wrapperStyle={structuredLegendWrapperStyle}
            content={(lp) => (
              <StructuredChartLegend
                payload={lp.payload}
                hidden={hidden}
                dimPairs={EXPENSE_ANOMALY_ACTUAL_PROJ_PAIRS}
                onItemClick={onLegendClick}
                rows={legendRows}
                shortLabels={EXPENSE_ANOMALY_LEGEND_SHORT_LABELS}
                dashedKeys={EXPENSE_ANOMALY_DASHED_SWATCH_KEYS}
              />
            )}
          />
          {displayRows.some((s) => s[UPPER_BAND_KEY] != null) && (
            <Line
              type="linear"
              dataKey={UPPER_BAND_KEY}
              name="Upper band"
              stroke={THRESHOLD_LINE_STROKE}
              strokeDasharray={THRESHOLD_LINE_DASH}
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={lineAnim}
              legendType="none"
            />
          )}
          {showLowerBandLine &&
            displayRows.some((s) => s[LOWER_BAND_KEY] != null) && (
              <Line
                type="linear"
                dataKey={LOWER_BAND_KEY}
                name="Lower band"
                stroke={THRESHOLD_LINE_STROKE}
                strokeDasharray={THRESHOLD_LINE_DASH}
                strokeWidth={1.5}
                dot={false}
                connectNulls
                isAnimationActive={lineAnim}
                legendType="none"
              />
            )}
          <Line
            type="linear"
            dataKey="total_expenses"
            name="Total expenses"
            stroke={chartColors[0]}
            strokeWidth={2}
            isAnimationActive={lineAnim}
            dot={(dotProps) => {
              const { key: dotKey, ...dotRest } = dotProps;
              return (
                <ExpenseTotalDot
                  key={dotKey}
                  {...dotRest}
                  highlightPeriod={highlightPeriod}
                  onAnomalyClick={handleOpenAnnotate}
                  markersHidden={hidden.has('anomalyMarkers')}
                />
              );
            }}
            hide={hidden.has('total_expenses')}
          />
          <Line
            type="linear"
            dataKey="anomalyMarkers"
            name="Anomalies"
            stroke="#f97316"
            strokeWidth={0}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            legendType="line"
          />
          {displayRows.some((s) => s.trend != null) && (
            <Line
              type="linear"
              dataKey="trend"
              name="Trend"
              stroke={chartColors[2]}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={lineAnim}
              hide={hidden.has('trend')}
            />
          )}
          {showProj && (
            <Line
              type="linear"
              dataKey="expProj"
              name="Projected"
              stroke={chartProjectionStroke}
              strokeWidth={2}
              strokeDasharray="8 4"
              dot={false}
              connectNulls
              isAnimationActive={lineAnim}
              hide={projectedLineHidden(hidden, 'total_expenses', 'expProj')}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      <AnomalyAnnotationModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedPeriod(null);
        }}
        periodLabel={selectedPeriod?.periodLabel ?? ''}
        existingNote={selectedPeriod?.existingNote ?? null}
        onSaved={(newNote) => {
          const label = selectedPeriod?.periodLabel;
          if (label) {
            setNotesByPeriod((prev) => ({ ...prev, [label]: newNote }));
          }
        }}
      />
    </>
  );
}
