import { getRedisClient } from './getRedisClient';
import { NextResponse } from 'next/server';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

// ---------------------------------------------------------------------------
// In-memory fallback limiter (used when Redis is unavailable)
// Fixed-window, per-process. Accurate enough for a single-instance deployment.
// ---------------------------------------------------------------------------

interface MemoryWindow {
  count: number;
  expiresAt: number; // ms epoch
}

const memoryStore = new Map<string, MemoryWindow>();

// Prune expired entries periodically to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of memoryStore) {
    if (window.expiresAt <= now) memoryStore.delete(key);
  }
}, 60_000);

function checkMemoryRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const existing = memoryStore.get(key);

  if (!existing || existing.expiresAt <= now) {
    memoryStore.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowSeconds };
  }

  existing.count += 1;
  const resetIn = Math.ceil((existing.expiresAt - now) / 1000);
  return {
    allowed: existing.count <= maxRequests,
    remaining: Math.max(0, maxRequests - existing.count),
    resetIn,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fixed-window rate limiter using Redis INCR + EXPIRE.
 * Falls back to an in-memory limiter when Redis is unavailable.
 */
export async function checkRateLimit(
  userId: string,
  endpoint: string,
  maxRequests: number = 30,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  const key = `ratelimit:${userId}:${endpoint}`;
  const client = await getRedisClient();

  if (!client) {
    return checkMemoryRateLimit(key, maxRequests, windowSeconds);
  }

  try {
    const count = await client.incr(key);

    // Set expiry only on the first request in the window
    if (count === 1) {
      await client.expire(key, windowSeconds);
    }

    const ttl = await client.ttl(key);

    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetIn: ttl > 0 ? ttl : windowSeconds,
    };
  } catch (error) {
    console.error('Rate limit check failed, using memory fallback:', error instanceof Error ? error.message : 'Unknown');
    return checkMemoryRateLimit(key, maxRequests, windowSeconds);
  }
}

/**
 * Convenience wrapper: checks rate limit and returns a 429 response
 * if the user has exceeded their quota, or null if allowed.
 */
export async function rateLimitGuard(
  userId: string,
  endpoint: string,
  maxRequests: number = 30,
  windowSeconds: number = 60
): Promise<NextResponse | null> {
  const result = await checkRateLimit(userId, endpoint, maxRequests, windowSeconds);

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.resetIn),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(result.resetIn),
        },
      }
    );
  }

  return null;
}
