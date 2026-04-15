/**
 * Simple in-memory cache with TTL for API route responses.
 * Lives in the Node.js process — works for single-instance deployments on Vercel.
 * Resets on redeploy or cold start, which is fine for a dashboard.
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
  createdAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** Default TTL: 5 minutes */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Get a cached value. Returns undefined if expired or not found.
 */
export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;

  if (Date.now() > entry.expires) {
    store.delete(key);
    return undefined;
  }

  return entry.data as T;
}

/**
 * Set a cached value with optional TTL in milliseconds.
 */
export function cacheSet<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, {
    data,
    expires: Date.now() + ttlMs,
    createdAt: Date.now(),
  });
}

/**
 * Invalidate a specific cache key.
 */
export function cacheInvalidate(key: string): void {
  store.delete(key);
}

/**
 * Invalidate all cache keys matching a prefix.
 * e.g., cacheInvalidatePrefix('baselinker:') clears all BaseLinker data.
 */
export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/**
 * Clear the entire cache.
 */
export function cacheClear(): void {
  store.clear();
}

/**
 * Build a cache key from an endpoint and params.
 */
export function buildCacheKey(endpoint: string, params: Record<string, string>): string {
  const sorted = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `${endpoint}:${sorted}`;
}

/**
 * Get the last update timestamp for a cache key.
 * Returns ISO string or null if not cached.
 */
export function cacheLastUpdated(key: string): string | null {
  const entry = store.get(key);
  if (!entry) return null;
  return new Date(entry.createdAt).toISOString();
}
