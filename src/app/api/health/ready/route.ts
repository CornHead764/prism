import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';
import { getRedisClient } from '@/lib/cache/getRedisClient';

/**
 * GET /api/health/ready
 *
 * Unauthenticated readiness probe. Returns 200 if both DB and Redis are
 * reachable, 503 if either is down. Used by the Docker healthcheck so
 * the container is only marked healthy when it can actually serve requests.
 *
 * Unlike /api/health/deep, this endpoint exposes no sensitive details —
 * just { db, redis } connectivity status.
 */
export async function GET() {
  const checks = {
    db: 'ok' as 'ok' | 'error',
    redis: 'ok' as 'ok' | 'error',
  };

  // Database check
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    checks.db = 'error';
  }

  // Redis check
  try {
    const client = await getRedisClient();
    if (!client) {
      checks.redis = 'error';
    } else {
      await client.ping();
    }
  } catch {
    checks.redis = 'error';
  }

  const healthy = checks.db === 'ok' && checks.redis === 'ok';
  return NextResponse.json(checks, { status: healthy ? 200 : 503 });
}
