import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'predictiq_reduced_motion';

const ReducedMotionContext = createContext(null);

/** Used when a chart or utility runs outside `ReducedMotionProvider` (e.g. unit tests). */
const FALLBACK_REDUCED_MOTION = {
  reducedMotionEnabled: false,
  setReducedMotionEnabled: () => {},
};

export function ReducedMotionProvider({ children }) {
  const [reducedMotionEnabled, setReducedMotionEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  useEffect(() => {
    const el = document.getElementById('root');
    if (!el) return;
    /*
     * Apply on `#root`, not `documentElement` or `body`: Theme mutates <html> inline styles;
     * `body` uses overflow:hidden; toggling attributes there correlated with Chromium paint bugs.
     * Scoped tokens still inherit to the whole app subtree under #root.
     */
    if (reducedMotionEnabled) {
      el.setAttribute('data-reduced-motion', 'true');
    } else {
      el.removeAttribute('data-reduced-motion');
    }
    localStorage.setItem(STORAGE_KEY, reducedMotionEnabled ? 'true' : 'false');
  }, [reducedMotionEnabled]);

  return (
    <ReducedMotionContext.Provider value={{ reducedMotionEnabled, setReducedMotionEnabled }}>
      {children}
    </ReducedMotionContext.Provider>
  );
}

export function useReducedMotionSetting() {
  const ctx = useContext(ReducedMotionContext);
  return ctx ?? FALLBACK_REDUCED_MOTION;
}
