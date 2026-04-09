import { NextResponse, NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { busRoutes } from '@/lib/db/schema';
import { validateRequest, updateBusRouteSchema } from '@/lib/validations';
import { invalidateCache } from '@/lib/cache/redis';
import { logError } from '@/lib/utils/logError';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const route = await db.query.busRoutes.findFirst({
      where: eq(busRoutes.id, id),
    });

    if (!route) {
      return NextResponse.json({ error: 'Bus route not found' }, { status: 404 });
    }

    return NextResponse.json(route);
  } catch (error) {
    logError('Failed to fetch bus route:', error);
    return NextResponse.json({ error: 'Failed to fetch bus route' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;

    try {
      const body = await request.json();
      const validation = validateRequest(updateBusRouteSchema, body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.issues },
          { status: 400 }
        );
      }

      const [updated] = await db.update(busRoutes)
        .set({ ...validation.data, updatedAt: new Date() })
        .where(eq(busRoutes.id, id))
        .returning();

      if (!updated) {
        return NextResponse.json({ error: 'Bus route not found' }, { status: 404 });
      }

      await invalidateCache('bus:*');
      return NextResponse.json(updated);
    } catch (error) {
      logError('Failed to update bus route:', error);
      return NextResponse.json({ error: 'Failed to update bus route' }, { status: 500 });
    }
  }, { permission: 'canModifySettings' });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;

    try {
      const [deleted] = await db.delete(busRoutes)
        .where(eq(busRoutes.id, id))
        .returning();

      if (!deleted) {
        return NextResponse.json({ error: 'Bus route not found' }, { status: 404 });
      }

      await invalidateCache('bus:*');
      return NextResponse.json({ success: true });
    } catch (error) {
      logError('Failed to delete bus route:', error);
      return NextResponse.json({ error: 'Failed to delete bus route' }, { status: 500 });
    }
  }, { permission: 'canModifySettings' });
}
