import { NextResponse, NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { busRoutes } from '@/lib/db/schema';
import { invalidateCache } from '@/lib/cache/redis';
import { logError } from '@/lib/utils/logError';

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    try {
      const body = await request.json() as { id: string; sortOrder: number }[];

      if (!Array.isArray(body) || body.some(item => !item.id || typeof item.sortOrder !== 'number')) {
        return NextResponse.json({ error: 'Invalid reorder payload' }, { status: 400 });
      }

      await db.transaction(async (tx) => {
        for (const { id, sortOrder } of body) {
          await tx.update(busRoutes)
            .set({ sortOrder, updatedAt: new Date() })
            .where(eq(busRoutes.id, id));
        }
      });

      await invalidateCache('bus:*');
      return NextResponse.json({ success: true });
    } catch (error) {
      logError('Failed to reorder bus routes:', error);
      return NextResponse.json({ error: 'Failed to reorder routes' }, { status: 500 });
    }
  }, { permission: 'canModifySettings' });
}
