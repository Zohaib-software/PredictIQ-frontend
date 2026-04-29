import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FinancialRecordsProvider } from '../context/FinancialRecordsContext';

export function mockChartData(overrides = {}) {
  return {
    labels: ['Jan 2025', 'Feb 2025'],
    periodLabels: ['Jan 2025', 'Feb 2025'],
    date: ['Jan 2025', 'Feb 2025'],
    revenue: [8500, 9100],
    expenses: [4200, 5300],
    netProfit: [4300, 3800],
    values: [8500, 5300],
    total_revenue: [8500, 9100],
    total_expenses: [4200, 5300],
    gross_profit: [4300, 3800],
    profit_margin: [50.6, 41.8],
    ad_spend: [1000, 1200],
    profit: [3300, 2600],
    outliers: [false, false],
    trend: [4200, 5300],
    trend_upper: [4600, 5700],
    trend_lower: [3800, 4900],
    matrix: [
      [1, 0.5],
      [0.5, 1],
    ],
    binLabels: ['0%-10%', '10%-20%'],
    counts: [1, 2],
    stages: [
      { name: 'Revenue', value: 12000 },
      { name: 'Operating profit', value: 6500 },
      { name: 'Net profit', value: 4300 },
    ],
    ...overrides,
  };
}

export function renderChart(Component, props) {
  return render(
    React.createElement(
      FinancialRecordsProvider,
      null,
      React.createElement(Component, { ...props })
    )
  );
}

function collectRowTexts() {
  const chartRows = screen.queryAllByTestId('chart-row');
  if (chartRows.length > 0) return chartRows.map((row) => row.textContent ?? '');

  const listItems = screen.queryAllByRole('listitem');
  if (listItems.length > 0) return listItems.map((item) => item.textContent ?? '');

  const tableRows = screen.queryAllByRole('row');
  if (tableRows.length > 0) {
    return tableRows
      .map((row) => within(row).queryAllByRole('cell').map((cell) => cell.textContent ?? '').join(' '))
      .filter(Boolean);
  }

  return [];
}

function rowContainsValue(rowText, expectedValue) {
  const rowTextLower = String(rowText).toLowerCase();
  const expectedValueLower = String(expectedValue).toLowerCase();
  if (rowTextLower.includes(expectedValueLower)) return true;
  const expectedNumber = Number(String(expectedValue).replace(/,/g, ''));
  if (!Number.isFinite(expectedNumber)) return false;
  return (
    rowText.includes(String(expectedNumber)) ||
    rowText.includes(expectedNumber.toFixed(1)) ||
    rowText.includes(expectedNumber.toFixed(2))
  );
}

export function runStandardChartTests(Component, mockData, config) {
  const {
    expectedPeriods = [],
    expectedValues = [],
    emptyData = {},
    emptyDataExpectation = 'none',
  } = config;

  describe(`${Component.name} standard behaviour`, () => {
    it('renders expected period labels in chart output context', () => {
      renderChart(Component, { data: mockData });
      const rows = collectRowTexts();
      expectedPeriods.forEach((period) => {
        expect(rows.some((rowText) => rowText.includes(period))).toBe(true);
      });
    });

    it('keeps each expected value bound to its period context', () => {
      renderChart(Component, { data: mockData });
      const rows = collectRowTexts();
      expectedValues.forEach(({ period, value }) => {
        expect(
          rows.some((rowText) => rowText.includes(period) && rowContainsValue(rowText, value))
        ).toBe(true);
      });
    });

    it('returns no chart rows for empty data state', () => {
      renderChart(Component, { data: emptyData });
      const rows = collectRowTexts();
      if (emptyDataExpectation === 'some') {
        expect(rows.length).toBeGreaterThan(0);
      } else {
        expect(rows).toHaveLength(0);
      }
    });
  });
}
