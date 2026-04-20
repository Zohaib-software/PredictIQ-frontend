import { useMemo } from 'react';
import { chartColors } from '../../../theme';
import { formatDecimal } from '../../../utils/displayFormat';

function getColor(r) {
  const t = (r + 1) / 2;
  if (t >= 0.8) return chartColors[0];
  if (t >= 0.5) return chartColors[1];
  if (t >= 0.2) return chartColors[2];
  if (t >= -0.2) return 'var(--color-border-light)';
  return chartColors[4];
}

export function CorrelationHeatmap({ data, intrinsicHeight = false }) {
  const labels = data?.labels ?? [];
  const matrix = data?.matrix ?? [];
  const displayLabels = useMemo(() => labels.map((l) => l.replace(/_/g, ' ')), [labels]);

  if (labels.length === 0) return null;

  return (
    <div
      style={{
        width: '100%',
        height: intrinsicHeight ? 'auto' : '100%',
        minHeight: 0,
        flex: intrinsicHeight ? '0 1 auto' : undefined,
        overflowX: 'auto',
        overflowY: intrinsicHeight ? 'visible' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      <table
        role="grid"
        aria-label="Correlation matrix"
        style={{ borderCollapse: 'collapse', width: 'min(100%, 760px)', tableLayout: 'fixed' }}
      >
        <thead>
          <tr>
            <th
              style={{
                padding: '6px 4px',
                textAlign: 'left',
                fontSize: 10,
                color: 'var(--color-secondary-text)',
                borderBottom: '1px solid var(--color-border-light)',
                width: '26%',
              }}
            />
            {displayLabels.map((l) => (
              <th
                key={l}
                style={{
                  padding: '6px 4px',
                  fontSize: 9,
                  color: 'var(--color-secondary-text)',
                  borderBottom: '1px solid var(--color-border-light)',
                  textAlign: 'center',
                  wordBreak: 'break-word',
                }}
              >
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <td
                style={{
                  padding: '5px 6px',
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--color-primary-text)',
                  borderBottom: '1px solid var(--color-border-light)',
                  wordBreak: 'break-word',
                }}
              >
                {displayLabels[i]}
              </td>
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: '5px 4px',
                    textAlign: 'center',
                    fontSize: 10,
                    backgroundColor: getColor(cell),
                    color: Math.abs(cell) > 0.5 ? '#fff' : 'var(--color-primary-text)',
                    borderBottom: '1px solid var(--color-border-light)',
                  }}
                  title={`${displayLabels[i]} vs ${displayLabels[j]}: ${formatDecimal(cell, 2)}`}
                >
                  {formatDecimal(cell, 2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
