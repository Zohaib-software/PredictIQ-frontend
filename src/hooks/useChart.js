import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFinancialRecords } from '../context/FinancialRecordsContext';
import { loadChartWithCache } from '../utils/chartCache';
import { isMissingFinancialDataApiError } from '../utils/chartDataErrors.js';

export { clearChartCache } from '../utils/chartCache';

function inferHasChartData(result) {
  if (!result || typeof result !== 'object') return null;

  if (Array.isArray(result)) {
    return result.some((value) => Number.isFinite(Number(value)) && Number(value) !== 0);
  }

  if (Array.isArray(result.records)) {
    return result.records.length > 0;
  }

  const numericSeriesKeys = [
    'total_revenue',
    'total_expenses',
    'gross_profit',
    'net_profit',
    'ad_spend',
    'profit_margin',
    'roi',
    'deltaExpenses',
    'deltaRevenue',
    'values',
  ];
  let sawSeries = false;
  for (const key of numericSeriesKeys) {
    if (Array.isArray(result[key])) {
      sawSeries = true;
      if (result[key].some((value) => Number.isFinite(Number(value)) && Number(value) !== 0)) {
        return true;
      }
    }
  }
  if (sawSeries) return false;

  for (const value of Object.values(result)) {
    if (value && typeof value === 'object') {
      const nested = inferHasChartData(value);
      if (nested === true) return true;
      if (nested === false) sawSeries = true;
    }
  }

  return sawSeries ? false : null;
}

export function useChart(fetcher, reloadDeps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const { token } = useAuth();
  const { hintFinancialRecordsFromChart } = useFinancialRecords();

  const reloadSig =
    reloadDeps === undefined || reloadDeps === null
      ? ''
      : Array.isArray(reloadDeps)
        ? reloadDeps.join('\u0001')
        : String(reloadDeps);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadChartWithCache(fetcherRef.current)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          const inferred = inferHasChartData(result);
          hintFinancialRecordsFromChart(inferred);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (isMissingFinancialDataApiError(err)) {
          setData(null);
          setError(null);
          return;
        }
        setError(err.message || 'Failed to load data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token, reloadSig, hintFinancialRecordsFromChart]);

  const refetch = () => {
    setLoading(true);
    setError(null);
    loadChartWithCache(fetcherRef.current)
      .then((result) => {
        setData(result);
        const inferred = inferHasChartData(result);
        hintFinancialRecordsFromChart(inferred);
      })
      .catch((err) => {
        if (isMissingFinancialDataApiError(err)) {
          setData(null);
          setError(null);
          return;
        }
        setError(err.message || 'Failed to load data');
      })
      .finally(() => setLoading(false));
  };

  return { data, loading, error, refetch };
}
