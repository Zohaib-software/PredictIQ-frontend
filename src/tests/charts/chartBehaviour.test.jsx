import React from 'react';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderChart, runStandardChartTests, mockChartData } from '../chartTestUtils';
import { buildAdSpendRevenueMergedChartRows } from '../../utils/chartSeriesRange';
import { RevenueExpensesChart } from '../../components/dashboard/charts/RevenueExpensesChart';
import { NetProfitChart } from '../../components/dashboard/charts/NetProfitChart';
import { CostBreakdownChart } from '../../components/dashboard/charts/CostBreakdownChart';
import { AdSpendRevenueChart } from '../../components/dashboard/charts/AdSpendRevenueChart';
import { ProfitMarginChart } from '../../components/dashboard/charts/ProfitMarginChart';
import { AdSpendRoiChart } from '../../components/dashboard/charts/AdSpendRoiChart';
import { ExpenseAnomalyChart } from '../../components/dashboard/charts/ExpenseAnomalyChart';
import { ExpenseVolatilityGauge } from '../../components/dashboard/charts/ExpenseVolatilityGauge';
import { CorrelationHeatmap } from '../../components/dashboard/charts/CorrelationHeatmap';
import { ElasticityChart } from '../../components/dashboard/charts/ElasticityChart';
import { RoiHistogramChart } from '../../components/dashboard/charts/RoiHistogramChart';
import { EfficiencyFunnelChart } from '../../components/dashboard/charts/EfficiencyFunnelChart';

vi.mock('recharts', () => {
  const passthrough = ({ children }) => <div>{children}</div>;
  const renderRows = (rows = []) =>
    Array.isArray(rows)
      ? rows.map((row, idx) => (
          <div data-testid="chart-row" key={`${idx}-${JSON.stringify(row)}`}>
            {JSON.stringify(row)}
          </div>
        ))
      : null;

  return {
    ResponsiveContainer: passthrough,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    ZAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
    Line: () => null,
    Bar: passthrough,
    Cell: () => null,
    Scatter: ({ data = [] }) => <div>{renderRows(data)}</div>,
    Pie: ({ data = [] }) => <div>{renderRows(data)}</div>,
    LineChart: ({ data = [], children }) => (
      <div>
        {renderRows(data)}
        {children}
      </div>
    ),
    BarChart: ({ data = [], children }) => (
      <div>
        {renderRows(data)}
        {children}
      </div>
    ),
    ScatterChart: ({ data = [], children }) => (
      <div>
        {renderRows(data)}
        {children}
      </div>
    ),
    ComposedChart: ({ children }) => <div>{children}</div>,
    PieChart: ({ data = [], children }) => (
      <div>
        {renderRows(data)}
        {children}
      </div>
    ),
  };
});

describe('Dashboard chart behaviour', () => {
  runStandardChartTests(
    RevenueExpensesChart,
    mockChartData({
      labels: ['Jan 2025', 'Feb 2025'],
      revenue: [8500, 9100],
      expenses: [4200, 5300],
    }),
    {
      expectedPeriods: ['Jan 2025', 'Feb 2025'],
      expectedValues: [
        { period: 'Jan 2025', value: '8500' },
        { period: 'Feb 2025', value: '5300' },
      ],
      emptyData: { labels: [], revenue: [], expenses: [] },
    }
  );

  runStandardChartTests(
    NetProfitChart,
    mockChartData({ date: ['Jan 2025', 'Feb 2025'], netProfit: [4300, 3800] }),
    {
      expectedPeriods: ['Jan 2025', 'Feb 2025'],
      expectedValues: [
        { period: 'Jan 2025', value: '4300' },
        { period: 'Feb 2025', value: '3800' },
      ],
      emptyData: { date: [], netProfit: [] },
    }
  );

  runStandardChartTests(
    CostBreakdownChart,
    mockChartData({ labels: ['Marketing', 'Operations'], values: [8500, 5300] }),
    {
      expectedPeriods: ['Marketing', 'Operations'],
      expectedValues: [
        { period: 'Marketing', value: '8500' },
        { period: 'Operations', value: '5300' },
      ],
      emptyData: { labels: [], values: [] },
    }
  );

  describe('AdSpendRevenueChart standard behaviour', () => {
    const baseData = mockChartData({
      date: ['Jan 2025', 'Feb 2025'],
      ad_spend: [1000, 1200],
      total_revenue: [8500, 9100],
    });
    const rowsFor = (data) => buildAdSpendRevenueMergedChartRows(data, 1, false);

    it('renders expected period labels in chart output context', () => {
      renderChart(AdSpendRevenueChart, { chartRows: rowsFor(baseData), showProjectedSeries: false });
      const chartRows = screen.queryAllByTestId('chart-row');
      const texts = chartRows.map((row) => row.textContent ?? '');
      expect(texts.some((t) => t.includes('Jan 2025'))).toBe(true);
      expect(texts.some((t) => t.includes('Feb 2025'))).toBe(true);
    });

    it('keeps each expected value bound to its period context', () => {
      renderChart(AdSpendRevenueChart, { chartRows: rowsFor(baseData), showProjectedSeries: false });
      const chartRows = screen.queryAllByTestId('chart-row');
      const texts = chartRows.map((row) => row.textContent ?? '');
      expect(texts.some((t) => t.includes('Jan 2025') && t.includes('1000'))).toBe(true);
      expect(texts.some((t) => t.includes('Feb 2025') && t.includes('9100'))).toBe(true);
    });

    it('returns no chart rows for empty data state', () => {
      renderChart(AdSpendRevenueChart, { chartRows: rowsFor({ date: [], ad_spend: [], total_revenue: [] }), showProjectedSeries: false });
      expect(screen.queryAllByTestId('chart-row')).toHaveLength(0);
    });
  });

  runStandardChartTests(
    ProfitMarginChart,
    mockChartData({
      date: ['Jan 2025', 'Feb 2025'],
      profit_margin: [51, 42],
      total_revenue: [8500, 9100],
      gross_profit: [4300, 3800],
    }),
    {
      expectedPeriods: ['Jan 2025', 'Feb 2025'],
      expectedValues: [
        { period: 'Jan 2025', value: '51' },
        { period: 'Feb 2025', value: '42' },
      ],
      emptyData: { date: [], profit_margin: [], total_revenue: [], gross_profit: [] },
    }
  );

  runStandardChartTests(
    AdSpendRoiChart,
    mockChartData({
      date: ['Jan 2025', 'Feb 2025'],
      ad_spend: [1000, 1200],
      total_revenue: [8500, 9100],
      profit: [3300, 2600],
    }),
    {
      expectedPeriods: ['Jan 2025', 'Feb 2025'],
      expectedValues: [
        { period: 'Jan 2025', value: '1000' },
        { period: 'Feb 2025', value: '9100' },
      ],
      emptyData: { ad_spend: [], total_revenue: [], total_expenses: [], profit: [], date: [] },
    }
  );

  runStandardChartTests(
    ExpenseAnomalyChart,
    mockChartData({
      date: ['Jan 2025', 'Feb 2025'],
      total_expenses: [4200, 5300],
      trend: [4200, 5300],
      trend_upper: [4600, 5700],
      trend_lower: [3800, 4900],
      outliers: [false, true],
    }),
    {
      expectedPeriods: ['Jan 2025', 'Feb 2025'],
      expectedValues: [
        { period: 'Jan 2025', value: '4200' },
        { period: 'Feb 2025', value: '5300' },
      ],
      emptyData: { date: [], total_expenses: [], trend: [], trend_upper: [], trend_lower: [] },
    }
  );

  runStandardChartTests(ExpenseVolatilityGauge, mockChartData({ score: 67, volatility: 350, mean: 1200 }), {
    expectedPeriods: ['filled'],
    expectedValues: [{ period: 'filled', value: '67' }],
    emptyData: { score: 0, volatility: null, mean: null },
    emptyDataExpectation: 'some',
  });

  // CorrelationHeatmap renders semantic table cells directly rather than Recharts internals.
  runStandardChartTests(
    CorrelationHeatmap,
    mockChartData({
      labels: ['total_revenue', 'total_expenses'],
      matrix: [
        [1, 0.5],
        [0.5, 1],
      ],
    }),
    {
      expectedPeriods: ['total revenue', 'total expenses'],
      expectedValues: [{ period: 'total revenue', value: '1.00' }],
      emptyData: { labels: [], matrix: [] },
    }
  );

  runStandardChartTests(
    ElasticityChart,
    mockChartData({
      period: ['Jan 2025', 'Feb 2025'],
      deltaExpenses: [2, 5],
      deltaRevenue: [3, 7],
      intercept: 1,
      slope: 1.2,
      elasticity: 1.2,
    }),
    {
      expectedPeriods: ['Jan 2025', 'Feb 2025'],
      expectedValues: [
        { period: 'Jan 2025', value: '2' },
        { period: 'Feb 2025', value: '7' },
      ],
      emptyData: { period: [], deltaExpenses: [], deltaRevenue: [] },
    }
  );

  runStandardChartTests(
    RoiHistogramChart,
    mockChartData({ binLabels: ['0%-10%', '10%-20%'], counts: [2, 4] }),
    {
      expectedPeriods: ['0%-10%', '10%-20%'],
      expectedValues: [{ period: '10%-20%', value: '4' }],
      emptyData: { binLabels: [], counts: [] },
    }
  );

  runStandardChartTests(
    EfficiencyFunnelChart,
    mockChartData({
      stages: [
        { name: 'Revenue', value: 12000 },
        { name: 'Operating profit', value: 6500 },
        { name: 'Net profit', value: 4300 },
      ],
    }),
    {
      expectedPeriods: ['Revenue', 'Operating profit', 'Net profit'],
      expectedValues: [{ period: 'Revenue', value: '£12K' }],
      emptyData: { stages: [] },
    }
  );
});
