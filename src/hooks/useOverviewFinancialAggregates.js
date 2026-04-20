import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getFinancialData } from '../api/dataApi';
import { useFinancialRecords } from '../context/FinancialRecordsContext';
import {
  computeSmallScreenDefaultIsoDatesFromMonthlyRecords,
  matchesSmallScreenForDefaultChartDates,
} from '../utils/smallScreenDefaultChartDateRange';

const AGGREGATION_PERIOD = 'monthly';

/**
 * Shared /api/data aggregate (monthly buckets + optional date range) for Overview:
 * Revenue/Expenses/Gross Profit section, Revenue vs Expenses chart, and Net Profit chart.
 */
export function useOverviewFinancialAggregates() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [chartData, setChartData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState(null);
  const { setFinancialRecordsPresence, refetchFinancialRecords } = useFinancialRecords();
  /** After first successful load behaviour (full-range desktop vs 1y mobile), or after reset — do not auto-set dates again. */
  const overviewDateInitRef = useRef({ consumed: false, userResetFilters: false });

  const fetchAggregated = useCallback(async () => {
    setChartLoading(true);
    try {
      const { data } = await getFinancialData({
        period: AGGREGATION_PERIOD,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if ((data?.records || []).length > 0) {
        setFinancialRecordsPresence(true);
      }
      setChartData(data);
      setSummary(data.summary || null);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Failed to load data');
    } finally {
      setChartLoading(false);
      setLoading(false);
    }
  }, [startDate, endDate, setFinancialRecordsPresence]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAggregated();
  }, [fetchAggregated]);

  useEffect(() => {
    if (overviewDateInitRef.current.consumed) return;
    if (chartLoading) return;
    const records = chartData?.records;
    if (!Array.isArray(records) || records.length === 0) return;

    if (overviewDateInitRef.current.userResetFilters) {
      overviewDateInitRef.current.consumed = true;
      return;
    }

    if (!matchesSmallScreenForDefaultChartDates()) {
      overviewDateInitRef.current.consumed = true;
      return;
    }

    const range = computeSmallScreenDefaultIsoDatesFromMonthlyRecords(records);
    if (!range) {
      overviewDateInitRef.current.consumed = true;
      return;
    }

    overviewDateInitRef.current.consumed = true;
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }, [chartLoading, chartData]);

  const resetFilters = useCallback(() => {
    overviewDateInitRef.current.userResetFilters = true;
    overviewDateInitRef.current.consumed = true;
    setStartDate('');
    setEndDate('');
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setChartLoading(true);
    refetchFinancialRecords();
    fetchAggregated();
  }, [fetchAggregated, refetchFinancialRecords]);

  const netProfitFromAggregates = useMemo(() => {
    const records = chartData?.records || [];
    if (!records.length) return null;
    return {
      date: records.map((r) => r.period),
      total_revenue: records.map((r) => r.total_revenue),
      total_expenses: records.map((r) => r.total_expenses),
      netProfit: records.map((r) =>
        Number((Number(r.total_revenue) - Number(r.total_expenses)).toFixed(2))
      ),
    };
  }, [chartData]);

  const revenueExpensesFromAggregates = useMemo(() => {
    const records = chartData?.records || [];
    if (!records.length) return null;
    return {
      labels: records.map((r) => r.period),
      revenue: records.map((r) => r.total_revenue),
      expenses: records.map((r) => r.total_expenses),
    };
  }, [chartData]);

  return {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    resetFilters,
    chartData,
    summary,
    loading,
    chartLoading,
    error,
    retry,
    netProfitFromAggregates,
    revenueExpensesFromAggregates,
  };
}
