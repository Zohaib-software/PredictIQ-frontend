import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForecastingPage } from '../../pages/dashboard/ForecastingPage';
import { getForecastTone } from '../../components/dashboard/SummaryCard';
import { forecastApi } from '../../api/forecastApi';
import { getFinancialData } from '../../api/dataApi';
import { useOverviewFinancialAggregates } from '../../hooks/useOverviewFinancialAggregates';

vi.mock('../../hooks/useOverviewFinancialAggregates', () => ({
  useOverviewFinancialAggregates: vi.fn(),
}));

vi.mock('../../api/dataApi', () => ({
  getFinancialData: vi.fn(),
}));

vi.mock('../../api/forecastApi', () => ({
  forecastApi: {
    cashFlow: vi.fn(),
  },
}));

vi.mock('recharts', () => {
  const passthrough = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: passthrough,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    Line: () => null,
    LineChart: passthrough,
  };
});

function renderForecastPage(override = {}) {
  useOverviewFinancialAggregates.mockReturnValue({
    startDate: '',
    endDate: '',
    setStartDate: vi.fn(),
    setEndDate: vi.fn(),
    resetFilters: vi.fn(),
    chartData: null,
    summary: null,
    loading: false,
    chartLoading: false,
    error: null,
    retry: vi.fn(),
    netProfitFromAggregates: null,
    revenueExpensesFromAggregates: null,
  });

  getFinancialData.mockResolvedValue({
    data: {
      records: [
        { period: 'Jan 2025', total_revenue: 10000, total_expenses: 8500 },
        { period: 'Feb 2025', total_revenue: 11000, total_expenses: 9000 },
      ],
      summary: {},
    },
  });

  forecastApi.cashFlow.mockResolvedValue({
    shortTermForecasts: {
      day30: { periodLabel: 'May 2025', predictedCashFlow: 12500 },
      day60: { periodLabel: 'Jun 2025', predictedCashFlow: 13200 },
      day90: { periodLabel: 'Jul 2025', predictedCashFlow: 11800 },
    },
    predictions: [{ periodLabel: 'May 2025', predictedCashFlow: 12500 }],
    accuracyMetrics: { MAE: 400, RMSE: 600, MAPE: 8.3 },
    ...override,
  });

  return render(<ForecastingPage />);
}

describe('Forecasting feature logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies forecast KPI tone boundaries consistently', () => {
    expect(getForecastTone(12500, 1000)).toBe('positive');
    expect(getForecastTone(500, 1000)).toBe('amber');
    expect(getForecastTone(-200, 1000)).toBe('negative');
    expect(getForecastTone(0, 1000)).toBe('amber');
    expect(getForecastTone(1000, 1000)).toBe('amber');
  });

  it('keeps 30-day and 90-day predicted values bound to the correct cards', async () => {
    renderForecastPage();

    await waitFor(() => {
      expect(screen.getByText('30-Day Forecast')).toBeInTheDocument();
      expect(screen.getByText('90-Day Forecast')).toBeInTheDocument();
    });

    const card30 = screen.getByText('30-Day Forecast').closest('div');
    const card90 = screen.getByText('90-Day Forecast').closest('div');

    expect(within(card30).getByTitle('£12,500.00')).toBeInTheDocument();
    expect(within(card90).getByTitle('£11,800.00')).toBeInTheDocument();
    expect(within(card90).queryByTitle('£12,500.00')).not.toBeInTheDocument();
    expect(within(card30).queryByTitle('£11,800.00')).not.toBeInTheDocument();
  });

  it('shows "Insufficient data" in the MAPE slot when MAPE is null', async () => {
    renderForecastPage({
      accuracyMetrics: { MAE: 400, RMSE: 600, MAPE: null },
    });

    const mapeLabel = await screen.findByText('MAPE');
    const mapeItem = mapeLabel.closest('div');

    expect(within(mapeItem).getByText('Insufficient data')).toBeInTheDocument();
    expect(within(mapeItem).queryByText(/\d+(\.\d+)?%/)).not.toBeInTheDocument();
  });

});
