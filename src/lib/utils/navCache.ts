/**
 * Module-level stale-while-revalidate cache for client-side navigation.
 *
 * Keys are API URLs. On navigation away and back, cached data is returned
 * immediately as initial state so pages render without a loading skeleton.
 * The fetch still runs in the background and updates state when it resolves.
 *
 * TTL is intentionally short (60s) — just long enough to survive a typical
 * subpage visit and return, while still showing fresh data on longer sessions.
 */

const store = new Map<string, { data: unknown; ts: number }>();
const TTL_MS = 60_000;

export function navCacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > TTL_MS) {
    store.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function navCacheSet(key: string, data: unknown): void {
  store.set(key, { data, ts: Date.now() });
}

/** Invalidate all keys matching a regex — call after mutations. */
export function navCacheInvalidate(pattern: RegExp): void {
  for (const key of store.keys()) {
    if (pattern.test(key)) store.delete(key);
  }
}
