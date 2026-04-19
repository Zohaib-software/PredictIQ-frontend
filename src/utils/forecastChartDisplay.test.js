import { describe, expect, it } from 'vitest';
import { filterForecastChartRowsByDateRange } from './forecastChartDisplay';

describe('filterForecastChartRowsByDateRange', () => {
  const rows = [
    { period: '2021-05', historicalCashFlow: 100, predictedCashFlow: null },
    { period: '2022-01', historicalCashFlow: 200, predictedCashFlow: null },
    { period: '2026-04', historicalCashFlow: 300, predictedCashFlow: 400 },
    { period: '2026-05', historicalCashFlow: null, predictedCashFlow: 500 },
  ];

  it('returns all rows when no bounds', () => {
    expect(filterForecastChartRowsByDateRange(rows, '', '')).toEqual(rows);
  });

  it('keeps only rows inside inclusive month range', () => {
    const out = filterForecastChartRowsByDateRange(rows, '2021-01-01', '2022-01-01');
    expect(out.map((r) => r.period)).toEqual(['2021-05', '2022-01']);
  });

  it('includes forecast months when range extends past last history', () => {
    const out = filterForecastChartRowsByDateRange(rows, '2026-04-01', '2026-06-01');
    expect(out.map((r) => r.period)).toEqual(['2026-04', '2026-05']);
  });
});
