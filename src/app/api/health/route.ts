import { NextResponse } from 'next/server';
import { checkDatabaseConnection } from '@/lib/db/client';
import { getRedisClient } from '@/lib/cache/getRedisClient';
import { APP_VERSION } from '@/lib/constants';

export async function GET() {
  const [dbOk, redisOk] = await Promise.all([
    checkDatabaseConnection().catch(() => false),
    getRedisClient().then(c => c !== null).catch(() => false),
  ]);

  const healthy = dbOk && redisOk;

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      uptime: Math.floor(process.uptime()),
      checks: {
        database: dbOk ? 'ok' : 'error',
        redis: redisOk ? 'ok' : 'error',
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
