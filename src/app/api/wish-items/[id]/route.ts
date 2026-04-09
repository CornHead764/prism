/**
 *
 * ENDPOINT: /api/wish-items/[id]
 * - PATCH:  Update a wish item
 * - DELETE: Delete a wish item
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { wishItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { updateWishItemSchema, validateRequest } from '@/lib/validations';
import { requireAuth } from '@/lib/auth';
import { invalidateCache } from '@/lib/cache/redis';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/wish-items/[id]
 * Updates a wish item (name, url, notes, sortOrder).
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    const [existing] = await db
      .select({ id: wishItems.id, memberId: wishItems.memberId })
      .from(wishItems)
      .where(eq(wishItems.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: 'Wish item not found' },
        { status: 404 }
      );
    }

    const validation = validateRequest(updateWishItemSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if ('name' in validation.data) updateData.name = validation.data.name;
    if ('url' in validation.data) updateData.url = validation.data.url || null;
    if ('notes' in validation.data) updateData.notes = validation.data.notes || null;

    await db
      .update(wishItems)
      .set(updateData)
      .where(eq(wishItems.id, id));

    const [updated] = await db
      .select()
      .from(wishItems)
      .where(eq(wishItems.id, id));

    if (!updated) {
      return NextResponse.json(
        { error: 'Wish item not found after update' },
        { status: 404 }
      );
    }

    await invalidateCache('wish-items:*');

    logActivity({
      userId: auth.userId,
      action: 'update',
      entityType: 'wish_item',
      entityId: updated.id,
      summary: `Updated wish item: ${updated.name}`,
    });

    return NextResponse.json({
      id: updated.id,
      memberId: updated.memberId,
      name: updated.name,
      url: updated.url,
      notes: updated.notes,
      sortOrder: updated.sortOrder,
      claimed: updated.claimed,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    logError('Error updating wish item:', error);
    return NextResponse.json(
      { error: 'Failed to update wish item' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/wish-items/[id]
 * Deletes a wish item. Only the list owner or parents can delete.
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const [existing] = await db
      .select({ id: wishItems.id, name: wishItems.name, memberId: wishItems.memberId })
      .from(wishItems)
      .where(eq(wishItems.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: 'Wish item not found' },
        { status: 404 }
      );
    }

    // Only the list owner or parents can delete
    const isOwner = existing.memberId === auth.userId;
    const isParent = auth.role === 'parent';
    if (!isOwner && !isParent) {
      return NextResponse.json(
        { error: 'Not authorized to delete this item' },
        { status: 403 }
      );
    }

    await db.delete(wishItems).where(eq(wishItems.id, id));

    await invalidateCache('wish-items:*');

    logActivity({
      userId: auth.userId,
      action: 'delete',
      entityType: 'wish_item',
      entityId: existing.id,
      summary: `Removed wish item: ${existing.name}`,
    });

    return NextResponse.json({
      message: 'Wish item deleted',
      deletedItem: { id: existing.id, name: existing.name },
    });
  } catch (error) {
    logError('Error deleting wish item:', error);
    return NextResponse.json(
      { error: 'Failed to delete wish item' },
      { status: 500 }
    );
  }
}
