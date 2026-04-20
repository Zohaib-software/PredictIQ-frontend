import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { chartColors } from '../../../theme';
import { useReducedMotionSetting } from '../../../context/ReducedMotionContext';
import { formatDecimal, formatGbp } from '../../../utils/displayFormat';

export function ExpenseVolatilityGauge({ data }) {
  const { reducedMotionEnabled } = useReducedMotionSetting();
  const score = data?.score ?? 0;
  const value = Math.min(100, Math.max(0, Number(score)));
  const filled = (value / 100) * 100;
  const remaining = 100 - filled;

  const gaugeData = [
    { name: 'filled', value: filled, color: value > 50 ? chartColors[4] : value > 25 ? chartColors[2] : chartColors[0] },
    { name: 'empty', value: remaining, color: 'var(--color-border-light)' },
  ].filter((d) => d.value > 0);

  if (gaugeData.length === 0) return null;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        height: '100%',
        minHeight: 260,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 'min(420px, 100%)',
          minWidth: 0,
          flex: '0 1 auto',
          height: 'min(300px, 100%)',
          marginLeft: 'auto',
          marginRight: 'auto',
          transform: 'translateY(4%)',
        }}
      >
        <div style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%" style={{ display: 'block' }}>
            <PieChart>
              <Pie
                data={gaugeData}
                cx="50%"
                cy="58%"
                startAngle={180}
                endAngle={0}
                innerRadius="47%"
                outerRadius="88%"
                dataKey="value"
                stroke="none"
                isAnimationActive={!reducedMotionEnabled}
              >
                {gaugeData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '56%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            width: '100%',
          }}
        >
          <span style={{ fontSize: '2.375rem', fontWeight: 700, color: 'var(--color-primary-text)' }}>
            {formatDecimal(value, 1)}
          </span>
          <span style={{ fontSize: '1rem', color: 'var(--color-secondary-text)', display: 'block' }}>
            Volatility score
          </span>
        </div>
      </div>
      {data?.volatility != null ? (
        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--color-secondary-text)',
            marginTop: 8,
            marginBottom: 0,
            textAlign: 'center',
            width: '100%',
          }}
        >
          Std dev: {formatGbp(data.volatility)} · Mean: {formatGbp(data.mean || 0)}
        </p>
      ) : null}
    </div>
  );
}
