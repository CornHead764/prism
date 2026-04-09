import { NextResponse, NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { busGeofenceLog } from '@/lib/db/schema';
import { logError } from '@/lib/utils/logError';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get('routeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

    if (!routeId) {
      return NextResponse.json({ error: 'routeId is required' }, { status: 400 });
    }

    const conditions = [eq(busGeofenceLog.routeId, routeId)];

    if (startDate) {
      conditions.push(gte(busGeofenceLog.tripDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(busGeofenceLog.tripDate, endDate));
    }

    const events = await db.select()
      .from(busGeofenceLog)
      .where(and(...conditions))
      .orderBy(desc(busGeofenceLog.eventTime))
      .limit(limit);

    return NextResponse.json(events);
  } catch (error) {
    logError('Failed to fetch bus history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
