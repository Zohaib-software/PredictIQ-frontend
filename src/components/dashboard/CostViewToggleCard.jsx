import { useMemo, useState } from 'react';
import { ChartCard } from './ChartCard';
import { FilterBar } from './FilterBar';
import { ExpenseVolatilityGauge } from './charts/ExpenseVolatilityGauge';
import { CostBreakdownChart } from './charts/CostBreakdownChart';
import { costBreakdownIsOnlyUncategorizedOperating } from '../../utils/costBreakdownLabels';
import { CHART_EMPTY_EXPENSE_VOLATILITY_AND_BREAKDOWN } from '../../constants/chartEmptyMessages.js';
import chartLayoutStyles from '../../pages/dashboard/DataPage.module.css';
import reportsChartStyles from '../../pages/dashboard/ReportsPage.module.css';
import chartCardStyles from './ChartCard.module.css';

export function CostViewToggleCard({
  className = '',
  /** Strip card chrome; stack volatility + breakdown with one filter row (Reports mobile). */
  narrowLayout = false,
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
  emptyMessage = CHART_EMPTY_EXPENSE_VOLATILITY_AND_BREAKDOWN,
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
        variant="plain"
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
        variant="plain"
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

  const filtersBar = narrowLayout
    ? null
    : showVolatility
      ? volatilityFiltersBar
      : breakdownFiltersBar;

  const showUncategorizedHint =
    !showVolatility &&
    hasData &&
    costBreakdownIsOnlyUncategorizedOperating(costBreakdownData);

  const showUncategorizedHintMobile =
    narrowLayout &&
    hasCostBreakdownData &&
    costBreakdownIsOnlyUncategorizedOperating(costBreakdownData);

  const combinedLoading = narrowLayout ? volatilityLoading || costBreakdownLoading : loading;
  const combinedError =
    narrowLayout ?
      volatilityError && costBreakdownError
        ? volatilityError
        : null
    : error;
  const combinedHasData = narrowLayout ? hasVolatilityData || hasCostBreakdownData : hasData;

  return (
    <div style={{ height: narrowLayout ? 'auto' : '100%', minHeight: 0, display: 'flex', width: '100%' }}>
      <ChartCard
        className={className}
        flatLayout={narrowLayout}
        emptyMessage={emptyMessage}
        filtersBarGapPx={narrowLayout ? 6 : 10}
        title={narrowLayout ? '' : title}
        subtitle={narrowLayout ? '' : subtitle}
        actions={narrowLayout ? null : viewToggle}
        filtersBar={filtersBar}
        loading={narrowLayout ? false : combinedLoading}
        error={narrowLayout ? null : combinedError}
        hasData={narrowLayout ? true : combinedHasData}
      >
        {narrowLayout ? (
          <div
            style={{
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              minHeight: 0,
              overflowX: 'clip',
              boxSizing: 'border-box',
            }}
          >
            <div className={chartCardStyles.flatChartCaption}>
              <h3 className={chartCardStyles.flatChartCaptionTitle}>Expense Volatility</h3>
              <p className={chartCardStyles.flatChartCaptionText}>
                0–100 score of monthly expense variability vs average; higher means bigger swings.
              </p>
            </div>
            <div className={reportsChartStyles.reportsMobileFiltersBarWrap}>{volatilityFiltersBar}</div>
            <div className={reportsChartStyles.reportsGaugePlotMobile}>
              <ExpenseVolatilityGauge data={volatilityData} />
            </div>
            <hr className={reportsChartStyles.reportsMobileInBlockDivider} aria-hidden="true" />
            <div className={chartCardStyles.flatChartCaption}>
              <h3 className={chartCardStyles.flatChartCaptionTitle}>Cost Breakdown by Category</h3>
              <p className={chartCardStyles.flatChartCaptionText}>
                Spend by category from each record’s saved expense breakdown, plus total ad spend.
                Anything not assigned to a category is grouped as Other.
              </p>
            </div>
            <div className={reportsChartStyles.reportsMobileFiltersBarWrap}>{breakdownFiltersBar}</div>
            <div className={chartLayoutStyles.chartPlotCompact}>
              <CostBreakdownChart data={costBreakdownData} intrinsicHeight />
            </div>
            {showUncategorizedHintMobile && (
              <p
                style={{
                  margin: '0.5rem 1rem 0',
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
          </div>
        ) : (
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
        )}
      </ChartCard>
    </div>
  );
}
