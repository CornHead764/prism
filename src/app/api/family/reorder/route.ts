import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateCache } from '@/lib/cache/redis';
import { logError } from '@/lib/utils/logError';

/**
 * PUT /api/family/reorder
 * Reorder family members. Accepts an array of { id, sortOrder } objects.
 */
export async function PUT(request: NextRequest) {
  return withAuth(async () => {
    try {
      const { order } = await request.json() as {
        order: { id: string; sortOrder: number }[];
      };

      if (!Array.isArray(order) || order.length === 0) {
        return NextResponse.json({ error: 'Order array required' }, { status: 400 });
      }

      for (const item of order) {
        await db.update(users).set({
          sortOrder: item.sortOrder,
          updatedAt: new Date(),
        }).where(eq(users.id, item.id));
      }

      await invalidateCache('family:*');
      await invalidateCache('calendar-groups:*');

      return NextResponse.json({ success: true });
    } catch (error) {
      logError('Error reordering family members:', error);
      return NextResponse.json(
        { error: 'Failed to reorder members' },
        { status: 500 }
      );
    }
  }, { permission: 'canManageUsers' });
}
