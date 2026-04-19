import { getAccessToken } from '../api/tokenStorage.js';

const CHART_CACHE_TTL_MS = 90000;
const chartCache = Object.create(null);

/** Hash JWT string to a stable scope id without storing the token in cache keys verbatim. */
function chartCacheScopeFromToken(token) {
  if (!token || typeof token !== 'string') return 'anon';
  let h = 0;
  for (let i = 0; i < token.length; i += 1) {
    h = ((h << 5) - h) + token.charCodeAt(i);
    h |= 0;
  }
  return `u${h}`;
}

function getChartCacheScope() {
  if (typeof localStorage === 'undefined') return 'anon';
  return chartCacheScopeFromToken(getAccessToken());
}

export function clearChartCache() {
  Object.keys(chartCache).forEach((key) => {
    delete chartCache[key];
  });
}

export async function loadChartWithCache(fetcher) {
  const cacheKey = fetcher?.cacheKey;
  const scope = getChartCacheScope();
  const scopedKey = cacheKey ? `${scope}:${cacheKey}` : null;

  if (scopedKey) {
    const cached = chartCache[scopedKey];
    if (cached && Date.now() - cached.fetchedAt < CHART_CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const result = await fetcher();
  if (scopedKey) {
    chartCache[scopedKey] = { data: result, fetchedAt: Date.now() };
  }
  return result;
}
