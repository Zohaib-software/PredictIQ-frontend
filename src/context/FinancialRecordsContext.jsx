import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CHART_EMPTY_GENERIC } from '../constants/chartEmptyMessages.js';

/** Re-export for older imports; prefer named constants from `constants/chartEmptyMessages.js`. */
export const EMPTY_FINANCIAL_CHART_MESSAGE = CHART_EMPTY_GENERIC;

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
