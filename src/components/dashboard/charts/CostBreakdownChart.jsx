import { useState, useCallback, useRef, useLayoutEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { costCategoryPalette } from '../../../theme';
import { useReducedMotionSetting } from '../../../context/ReducedMotionContext';
import { formatGbp } from '../../../utils/displayFormat';

/** Reserve horizontal space for legend + gap so the square pie never overlaps labels. */
const LEGEND_RESERVE_PX = 118;

export function CostBreakdownChart({ data }) {
  const { reducedMotionEnabled } = useReducedMotionSetting();
  const [hiddenNames, setHiddenNames] = useState(() => new Set());
  const containerRef = useRef(null);
  const [chartBoxPx, setChartBoxPx] = useState(248);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = r.width;
      const h = r.height;
      if (w < 8 || h < 8) return;
      const side = Math.min(h, Math.max(0, w - LEGEND_RESERVE_PX));
      const clamped = Math.min(360, Math.max(180, Math.floor(side)));
      setChartBoxPx(clamped);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  if (!data?.labels?.length) return null;
  const series = data.labels
    .map((label, i) => ({
      name: label || 'Other',
      value: data.values?.[i] ?? 0,
    }))
    .filter((d) => d.value > 0);

  if (series.length === 0) return null;

  const toggleSeriesVisibility = useCallback(
    (name) => {
      const s = String(name);
      setHiddenNames((prev) => {
        const next = new Set(prev);
        if (next.has(s)) {
          next.delete(s);
        } else {
          const wouldHide = new Set(next);
          wouldHide.add(s);
          const stillVisible = series.filter((x) => !wouldHide.has(x.name));
          if (stillVisible.length === 0) return prev;
          next.add(s);
        }
        return next;
      });
    },
    [series]
  );

  /** Only non-hidden slices — the pie redraws full 360° so it doesn’t look “bitten”. */
  const visibleSeries = series.filter((d) => !hiddenNames.has(d.name));

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.3rem',
        width: '100%',
      }}
    >
      <div
        style={{
          width: chartBoxPx,
          height: chartBoxPx,
          maxWidth: '100%',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={visibleSeries}
              cx="50%"
              cy="50%"
              innerRadius="56%"
              outerRadius="88%"
              paddingAngle={visibleSeries.length > 1 ? 2 : 0}
              dataKey="value"
              nameKey="name"
              isAnimationActive={!reducedMotionEnabled}
            >
              {visibleSeries.map((entry) => {
                const originalIndex = series.findIndex((s) => s.name === entry.name);
                const i = originalIndex >= 0 ? originalIndex : 0;
                return (
                  <Cell
                    key={entry.name}
                    fill={costCategoryPalette[i % costCategoryPalette.length]}
                    stroke="var(--color-card-bg)"
                    strokeWidth={1}
                  />
                );
              })}
            </Pie>
            <Tooltip
              allowEscapeViewBox={{ x: false, y: false }}
              contentStyle={{
                background: 'var(--color-card-bg)',
                border: '1px solid var(--color-border-light)',
                borderRadius: 8,
                color: 'var(--color-primary-text)',
              }}
              labelStyle={{ color: 'var(--color-primary-text)' }}
              itemStyle={{ color: 'var(--color-primary-text)' }}
              formatter={(value, name) => [formatGbp(value), name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div
        role="group"
        aria-label="Cost categories"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '0.45rem',
          flexShrink: 0,
          paddingRight: 2,
          fontSize: '0.92rem',
          lineHeight: 1.55,
        }}
      >
        {series.map((entry, i) => {
          const color = costCategoryPalette[i % costCategoryPalette.length];
          const hidden = hiddenNames.has(entry.name);
          return (
            <button
              key={entry.name}
              type="button"
              onClick={() => toggleSeriesVisibility(entry.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                margin: 0,
                padding: 0,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--color-primary-text)',
                textAlign: 'left',
                font: 'inherit',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  flexShrink: 0,
                  background: color,
                  opacity: hidden ? 0.45 : 1,
                }}
              />
              <span style={{ opacity: hidden ? 0.45 : 1 }}>{entry.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
