/**
 * PredictIQ design tokens: single source of truth for colors and spacing.
 * Used by ThemeContext and any component that needs theme values in JS.
 */
export const tokens = {
  light: {
    primaryText: '#2E2E2E',
    inputText: '#000000',
    secondaryText: '#6A6A6A',
    background: '#FBFBFA',
    accent: '#37C1A5',
    accentHover: '#2da892',
    accentWarm: '#EACBB5',
    success: '#2E8B57',
    error: '#C2453C',
    border: '#6A6A6A',
    borderLight: 'rgba(106, 106, 106, 0.25)',
    cardBg: '#ffffff',
    inputBg: '#ffffff',
    focusRing: '#37C1A5',
    /** Universal colour for all linear / trend projection overlays (dashed lines, projected bars) */
    chartProjection: '#9333EA',
    /** OLS / linear regression overlays on scatters (dark on light chart areas) */
    chartLinearTrend: '#000000',
  },
  dark: {
    primaryText: '#E8E8E8',
    inputText: '#F5F5F5',
    secondaryText: '#B0B0B0',
    background: '#1A1B1E',
    accent: '#37C1A5',
    accentHover: '#4dd4b8',
    accentWarm: '#C4A88A',
    success: '#3CB371',
    error: '#E07A72',
    border: '#6A6A6A',
    borderLight: 'rgba(255, 255, 255, 0.12)',
    cardBg: '#25262B',
    inputBg: '#1A1B1E',
    focusRing: '#37C1A5',
    chartProjection: '#C4B5FD',
    chartLinearTrend: '#FFFFFF',
  },
};

/** Stroke/fill for Recharts; use for every projected series */
export const chartProjectionStroke = 'var(--color-chart-projection)';

/** OLS / linear regression line on elasticity & ad spend ROI scatters (theme via ThemeProvider) */
export const chartLinearTrendStroke = 'var(--color-chart-linear-trend)';

export const chartColors = [
  '#37C1A5',
  '#2E8B57',
  '#EACBB5',
  '#6A6A6A',
  '#2E2E2E',
  '#259680',
  '#C4A88A',
  '#4dd4b8',
];

/**
 * Maximally distinct hues for categorical pies (cost breakdown, etc.).
 * Keeps line/bar chart semantics on `chartColors` unchanged.
 */
export const costCategoryPalette = [
  '#4E79A7',
  '#F28E2B',
  '#59A14F',
  '#E15759',
  '#76B7B2',
  '#EDC948',
  '#B07AA1',
  '#FF9DA7',
  '#9C755F',
  '#BAB0AC',
  '#499894',
  '#D37295',
  '#A0CBE8',
  '#FFBE7D',
  '#8CD17D',
  '#B6992D',
];
