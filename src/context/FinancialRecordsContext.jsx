import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/** Shown in chart areas when the user has no financial records yet (use with `.chart-empty-financial-copy` for line breaks). */
export const EMPTY_FINANCIAL_CHART_MESSAGE =
  'No financial data yet. Upload a CSV to see revenue,\nexpenses, and gross profit over time.';

const FinancialRecordsContext = createContext(null);

export function FinancialRecordsProvider({ children }) {
  const [hasFinancialRecords, setHasFinancialRecords] = useState(null);

  const setFinancialRecordsPresence = useCallback((nextValue) => {
    if (typeof nextValue !== 'boolean') return;
    setHasFinancialRecords(nextValue);
  }, []);

  const value = useMemo(() => {
    return {
      loadingRecords: hasFinancialRecords === null,
      hasFinancialRecords,
      refetchFinancialRecords: () => Promise.resolve(),
      setFinancialRecordsPresence,
      clearFinancialRecords: () => setHasFinancialRecords(false),
    };
  }, [hasFinancialRecords, setFinancialRecordsPresence]);

  return (
    <FinancialRecordsContext.Provider value={value}>{children}</FinancialRecordsContext.Provider>
  );
}

export function useFinancialRecords() {
  const ctx = useContext(FinancialRecordsContext);
  if (!ctx) {
    return {
      loadingRecords: false,
      hasFinancialRecords: true,
      refetchFinancialRecords: () => Promise.resolve(),
      setFinancialRecordsPresence: () => {},
      clearFinancialRecords: () => {},
    };
  }
  return ctx;
}
