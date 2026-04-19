import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis,
  DefaultTooltipContent,
} from 'recharts';
import { useLegendToggleGroups } from '../../../hooks/useLegendToggleGroups';
import { useReducedMotionSetting } from '../../../context/ReducedMotionContext';
import { legendEntryDimmed } from '../../../utils/chartLegendVisibility';
import { chartColors, chartLinearTrendStroke } from '../../../theme';
import { paddedNumericDomain } from '../../../utils/chartAxisDomain';
import { olsSlopeIntercept } from '../../../utils/chartSeriesRange';
import { formatChartAxisGBP, formatGbp } from '../../../utils/displayFormat';

const SCATTER_LEGEND = 'Ad Spend vs Revenue';

/** Own y field so legend `dataKey` does not clash with the scatter series. */
const TREND_DATA_KEY = 'trendRevenue';

const AD_SPEND_ROI_LEGEND_GROUPS = {
  scatter: ['total_revenue'],
  linearTrend: [TREND_DATA_KEY],
};

const AD_SPEND_ROI_TOOLTIP_PANEL_STYLE = {
  background: 'var(--color-card-bg)',
  border: '1px solid var(--color-border-light)',
  borderRadius: 8,
};

function isAdSpendRoiTrendPoint(row) {
  if (!row || typeof row !== 'object') return false;
  const tr = row[TREND_DATA_KEY];
  return tr != null && Number.isFinite(Number(tr)) && row.total_revenue == null;
}

function buildAdSpendRoiTooltipPayload(row) {
  if (!row) return [];
  if (isAdSpendRoiTrendPoint(row)) {
    return [
      {
        dataKey: 'ad_spend',
        name: 'Ad spend',
        value: row.ad_spend,
        color: chartLinearTrendStroke,
      },
      {
        dataKey: TREND_DATA_KEY,
        name: 'OLS trend (revenue)',
        value: row[TREND_DATA_KEY],
        color: chartLinearTrendStroke,
      },
    ];
  }
  const out = [
    {
      dataKey: 'ad_spend',
      name: 'Ad spend',
      value: row.ad_spend,
      color: chartColors[0],
    },
    {
      dataKey: 'total_revenue',
      name: 'Revenue',
      value: row.total_revenue,
      color: chartColors[0],
    },
  ];
  if (Number.isFinite(Number(row.profit))) {
    out.push({
      dataKey: 'profit',
      name: 'Profit',
      value: row.profit,
      color: chartColors[1],
    });
  }
  return out;
}

function AdSpendRoiTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const synthetic = buildAdSpendRoiTooltipPayload(row);
  const showPeriod = row.period != null && String(row.period).trim() !== '';

  return (
    <div style={AD_SPEND_ROI_TOOLTIP_PANEL_STYLE}>
      {showPeriod ? (
        <p
          style={{
            margin: 0,
            padding: '10px 10px 0',
            fontWeight: 600,
            fontSize: 12,
            color: 'var(--color-secondary-text)',
          }}
        >
          Period: {row.period}
        </p>
      ) : null}
      <DefaultTooltipContent
        active={active}
        payload={synthetic}
        formatter={(value, name) =>
          value != null && Number.isFinite(Number(value)) ? [formatGbp(Number(value)), name] : ['—', name]
        }
        contentStyle={{
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
        }}
      />
    </div>
  );
}

function buildTrendLinePoints(points, regression) {
  if (!regression || points.length < 2) return null;
  const { slope, intercept } = regression;
  const xs = points.map((p) => Number(p.ad_spend)).filter((n) => Number.isFinite(n));
  if (xs.length < 2) return null;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null;
  const yAt = (x) => Math.round((intercept + slope * x) * 100) / 100;
  return [
    { ad_spend: minX, [TREND_DATA_KEY]: yAt(minX) },
    { ad_spend: maxX, [TREND_DATA_KEY]: yAt(maxX) },
  ];
}

export function AdSpendRoiChart({ data }) {
  const { reducedMotionEnabled } = useReducedMotionSetting();
  const scatterAnim = !reducedMotionEnabled;
  const { hidden, onLegendClick } = useLegendToggleGroups(AD_SPEND_ROI_LEGEND_GROUPS);

  if (!data?.ad_spend?.length) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-secondary-text)', fontSize: 14 }}>
        No ad spend ROI data in the selected date range. Adjust the filters or reset.
      </div>
    );
  }
  const points = data.ad_spend.map((ad, i) => ({
    ad_spend: ad,
    total_revenue: data.total_revenue?.[i] ?? 0,
    profit: data.profit?.[i] ?? 0,
    period: data.date?.[i] ?? i,
  }));

  const regression = data.regression ?? olsSlopeIntercept(data.ad_spend, data.total_revenue);
  const trendLine = buildTrendLinePoints(points, regression);

  const xDomain = paddedNumericDomain([data.ad_spend]);
  const yDomain = paddedNumericDomain(
    [
      data.total_revenue,
      trendLine?.length ? trendLine.map((p) => p[TREND_DATA_KEY]) : [],
    ].filter((a) => Array.isArray(a) && a.length > 0),
    { padRatio: 0.06 }
  );

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart margin={{ top: 10, right: 14, left: 6, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
        <XAxis
          type="number"
          dataKey="ad_spend"
          name="Ad Spend"
          stroke="var(--color-secondary-text)"
          tick={{ fontSize: 13, fill: 'var(--color-secondary-text)' }}
          tickFormatter={formatChartAxisGBP}
          tickMargin={6}
          domain={xDomain}
        />
        <YAxis
          type="number"
          dataKey="total_revenue"
          name="Revenue"
          stroke="var(--color-secondary-text)"
          tick={{ fontSize: 13, fill: 'var(--color-secondary-text)' }}
          tickFormatter={formatChartAxisGBP}
          tickMargin={8}
          width={58}
          domain={yDomain}
        />
        <ZAxis type="number" dataKey="profit" range={[80, 400]} name="Profit" />
        <Tooltip
          allowEscapeViewBox={{ x: false, y: false }}
          content={(tipProps) => <AdSpendRoiTooltip {...tipProps} />}
        />
        <Legend
          wrapperStyle={{ cursor: 'pointer' }}
          onClick={onLegendClick}
          formatter={(value, entry) => (
            <span
              style={{
                opacity: legendEntryDimmed(hidden, entry.dataKey, []) ? 0.45 : 1,
              }}
            >
              {value}
            </span>
          )}
        />
        {trendLine ? (
          <Line
            type="linear"
            data={trendLine}
            dataKey={TREND_DATA_KEY}
            name="OLS fit (revenue vs ad spend)"
            stroke={chartLinearTrendStroke}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            connectNulls
            isAnimationActive={false}
            hide={hidden.has(TREND_DATA_KEY)}
          />
        ) : null}
        <Scatter
          name={SCATTER_LEGEND}
          data={points}
          dataKey="total_revenue"
          fill={chartColors[0]}
          fillOpacity={0.8}
          isAnimationActive={scatterAnim}
          hide={hidden.has('total_revenue')}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
