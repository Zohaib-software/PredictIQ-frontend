/** Used by dashboard/settings shells: match drawer breakpoint & route-close effects. */
export const MOBILE_NAV_MEDIA = '(max-width: 1024px)';

/** Desktop: expanded; narrow viewports: collapsed by default (avoids open-then-close flash). */
export function getInitialSidebarOpen() {
  if (typeof window === 'undefined') return true;
  try {
    return !window.matchMedia(MOBILE_NAV_MEDIA).matches;
  } catch {
    return true;
  }
}
