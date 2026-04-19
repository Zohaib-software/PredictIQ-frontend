import { useMemo, useState } from 'react';
import { ChartCard } from './ChartCard';
import { FilterBar } from './FilterBar';
import { ExpenseVolatilityGauge } from './charts/ExpenseVolatilityGauge';
import { CostBreakdownChart } from './charts/CostBreakdownChart';
import { costBreakdownIsOnlyUncategorizedOperating } from '../../utils/costBreakdownLabels';

export function CostViewToggleCard({
  className = '',
  volatilityData,
  volatilityLoading,
  volatilityError,
  hasVolatilityData,
  costBreakdownData,
  costBreakdownLoading,
  costBreakdownError,
  hasCostBreakdownData,
  volatilityStartDate,
  onVolatilityStartDateChange,
  volatilityEndDate,
  onVolatilityEndDateChange,
  onResetVolatilityDateRange,
  breakdownStartDate,
  onBreakdownStartDateChange,
  breakdownEndDate,
  onBreakdownEndDateChange,
  onResetBreakdownDateRange,
}) {
  const [activeView, setActiveView] = useState('volatility');
  const showVolatility = activeView === 'volatility';

  const title = showVolatility
    ? 'Expense Volatility'
    : 'Cost Breakdown by Category';
  const subtitle = showVolatility
    ? '0–100 score of monthly expense variability vs average; higher means bigger swings.'
    : 'Spend by category from each record’s saved expense breakdown, plus total ad spend. Anything not assigned to a category is grouped as Other.';
  const loading = showVolatility
    ? volatilityLoading
    : costBreakdownLoading;
  const error = showVolatility
    ? volatilityError
    : costBreakdownError;
  const hasData = showVolatility
    ? hasVolatilityData
    : hasCostBreakdownData;

  const viewToggle = useMemo(
    () => (
      <div
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          gap: '0.25rem',
          padding: '0.2rem',
          borderRadius: 'var(--radius-md, 8px)',
          background: 'var(--color-page-bg, rgba(0, 0, 0, 0.2))',
          border: '1px solid var(--color-border-light)',
        }}
        role="group"
        aria-label="Cost chart view"
      >
        <button
          type="button"
          onClick={() => setActiveView('volatility')}
          aria-pressed={showVolatility}
          style={{
            fontSize: '0.8rem',
            fontWeight: 500,
            padding: '0.35rem 0.65rem',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 0.15s, color 0.15s',
            color: showVolatility ? 'var(--color-primary-text)' : 'var(--color-secondary-text)',
            background: showVolatility ? 'var(--color-card-bg)' : 'transparent',
            boxShadow: showVolatility ? '0 1px 2px rgba(0, 0, 0, 0.06)' : 'none',
          }}
        >
          Volatility
        </button>
        <button
          type="button"
          onClick={() => setActiveView('breakdown')}
          aria-pressed={!showVolatility}
          style={{
            fontSize: '0.8rem',
            fontWeight: 500,
            padding: '0.35rem 0.65rem',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 0.15s, color 0.15s',
            color:
              !showVolatility
                ? 'var(--color-primary-text)'
                : 'var(--color-secondary-text)',
            background:
              !showVolatility ? 'var(--color-card-bg)' : 'transparent',
            boxShadow:
              !showVolatility ? '0 1px 2px rgba(0, 0, 0, 0.06)' : 'none',
          }}
        >
          Cost Breakdown
        </button>
      </div>
    ),
    [showVolatility]
  );

  const volatilityFiltersBar = useMemo(
    () => (
      <FilterBar
        startDate={volatilityStartDate}
        onStartDateChange={onVolatilityStartDateChange}
        endDate={volatilityEndDate}
        onEndDateChange={onVolatilityEndDateChange}
        onReset={onResetVolatilityDateRange}
        idPrefix="reports-cost-volatility-date-range"
        variant="embedded"
      />
    ),
    [
      volatilityEndDate,
      volatilityStartDate,
      onResetVolatilityDateRange,
      onVolatilityEndDateChange,
      onVolatilityStartDateChange,
    ]
  );

  const breakdownFiltersBar = useMemo(
    () => (
      <FilterBar
        startDate={breakdownStartDate}
        onStartDateChange={onBreakdownStartDateChange}
        endDate={breakdownEndDate}
        onEndDateChange={onBreakdownEndDateChange}
        onReset={onResetBreakdownDateRange}
        idPrefix="reports-cost-breakdown-date-range"
        variant="embedded"
      />
    ),
    [
      breakdownEndDate,
      breakdownStartDate,
      onBreakdownEndDateChange,
      onBreakdownStartDateChange,
      onResetBreakdownDateRange,
    ]
  );

  const filtersBar = showVolatility ? volatilityFiltersBar : breakdownFiltersBar;

  const showUncategorizedHint =
    !showVolatility &&
    hasData &&
    costBreakdownIsOnlyUncategorizedOperating(costBreakdownData);

  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex' }}>
      <ChartCard
        className={className}
        title={title}
        subtitle={subtitle}
        actions={viewToggle}
        filtersBar={filtersBar}
        loading={loading}
        error={error}
        hasData={hasData}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {showVolatility ? (
            <ExpenseVolatilityGauge data={volatilityData} />
          ) : (
            <>
              <CostBreakdownChart data={costBreakdownData} />
              {showUncategorizedHint && (
                <p
                  style={{
                    margin: '0.5rem 0 0',
                    fontSize: '0.8rem',
                    lineHeight: 1.45,
                    color: 'var(--color-secondary-text)',
                  }}
                >
                  Your data does not yet split day-to-day costs into categories, so that spend
                  appears as Other. To see slices such as rent or software here, import a CSV that
                  includes separate columns for those costs and map each column to a category when
                  you set up the import.
                </p>
              )}
            </>
          )}
        </div>
      </ChartCard>
    </div>
  );
}
