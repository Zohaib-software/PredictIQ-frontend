import { useEffect, useMemo, useState } from 'react';

const PROJECTION_OPTIONS = [1, 2, 3];

function readProjection(chartId, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const parsed = Number.parseInt(localStorage.getItem(`predictiq_chart_projection_${chartId}`), 10);
    if (PROJECTION_OPTIONS.includes(parsed)) return parsed;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function useChartFilters(chartId, { defaultProjectionMonths = 1 } = {}) {
  const [projectionMonths, setProjectionMonths] = useState(() =>
    readProjection(chartId, defaultProjectionMonths)
  );

  useEffect(() => {
    try {
      localStorage.setItem(`predictiq_chart_projection_${chartId}`, String(projectionMonths));
    } catch {
      /* ignore */
    }
  }, [chartId, projectionMonths]);

  return useMemo(
    () => ({
      projectionMonths,
      setProjectionMonths,
    }),
    [projectionMonths]
  );
}
