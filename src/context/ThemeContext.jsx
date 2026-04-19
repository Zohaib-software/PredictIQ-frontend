import { createContext, useContext, useState, useEffect } from 'react';
import { tokens } from '../theme';

const STORAGE_KEY = 'predictiq_theme';
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem(STORAGE_KEY) || 'light');
  });

  useEffect(() => {
    const root = document.documentElement;
    const t = tokens[mode];
    root.style.setProperty('--color-primary-text', t.primaryText);
    root.style.setProperty('--color-secondary-text', t.secondaryText);
    root.style.setProperty('--color-input-text', t.inputText ?? t.primaryText);
    root.style.setProperty('--color-background', t.background);
    root.style.setProperty('--color-accent', t.accent);
    root.style.setProperty('--color-accent-hover', t.accentHover);
    root.style.setProperty('--color-accent-warm', t.accentWarm);
    root.style.setProperty('--color-success', t.success);
    root.style.setProperty('--color-error', t.error);
    root.style.setProperty('--color-border', t.border);
    root.style.setProperty('--color-border-light', t.borderLight);
    root.style.setProperty('--color-card-bg', t.cardBg);
    root.style.setProperty('--color-input-bg', t.inputBg ?? t.cardBg);
    root.style.setProperty('--color-focus-ring', t.focusRing);
    root.style.setProperty('--color-chart-projection', t.chartProjection);
    root.style.setProperty('--color-chart-linear-trend', t.chartLinearTrend);
    root.setAttribute('data-theme', mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggleTheme = () => setMode((m) => (m === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
