/**
 * ENDPOINT: /api/gift-ideas/[id]
 * - PATCH:  Update a gift idea (creator only)
 * - DELETE: Delete a gift idea (creator only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { giftIdeas } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { updateGiftIdeaSchema, validateRequest } from '@/lib/validations';
import { invalidateCache } from '@/lib/cache/redis';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const [existing] = await db
      .select({ id: giftIdeas.id, createdBy: giftIdeas.createdBy })
      .from(giftIdeas)
      .where(and(eq(giftIdeas.id, id), eq(giftIdeas.createdBy, auth.userId)));

    if (!existing) {
      return NextResponse.json({ error: 'Gift idea not found' }, { status: 404 });
    }

    const validation = validateRequest(updateGiftIdeaSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      ...validation.data,
      updatedAt: new Date(),
    };

    // Handle url/notes/price: empty string → null
    if (updateData.url === '') updateData.url = null;
    if (updateData.notes === '') updateData.notes = null;
    if (updateData.price === '') updateData.price = null;

    // Handle purchased toggle
    if ('purchased' in body) {
      updateData.purchased = body.purchased;
      updateData.purchasedAt = body.purchased ? new Date() : null;
    }

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    const [updated] = await db
      .update(giftIdeas)
      .set(updateData)
      .where(eq(giftIdeas.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update gift idea' }, { status: 500 });
    }

    await invalidateCache(`gift-ideas:${auth.userId}:*`);

    logActivity({
      userId: auth.userId,
      action: 'update',
      entityType: 'gift_idea',
      entityId: id,
      summary: `Updated gift idea: ${updated.name}`,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      url: updated.url,
      notes: updated.notes,
      price: updated.price,
      purchased: updated.purchased,
      purchasedAt: updated.purchasedAt?.toISOString() || null,
      sortOrder: updated.sortOrder,
      forUserId: updated.forUserId,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    logError('Error updating gift idea:', error);
    return NextResponse.json({ error: 'Failed to update gift idea' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    // Verify ownership
    const [existing] = await db
      .select({ id: giftIdeas.id, name: giftIdeas.name, createdBy: giftIdeas.createdBy })
      .from(giftIdeas)
      .where(and(eq(giftIdeas.id, id), eq(giftIdeas.createdBy, auth.userId)));

    if (!existing) {
      return NextResponse.json({ error: 'Gift idea not found' }, { status: 404 });
    }

    await db.delete(giftIdeas).where(eq(giftIdeas.id, id));

    await invalidateCache(`gift-ideas:${auth.userId}:*`);

    logActivity({
      userId: auth.userId,
      action: 'delete',
      entityType: 'gift_idea',
      entityId: id,
      summary: `Deleted gift idea: ${existing.name}`,
    });

    return NextResponse.json({ message: 'Gift idea deleted' });
  } catch (error) {
    logError('Error deleting gift idea:', error);
    return NextResponse.json({ error: 'Failed to delete gift idea' }, { status: 500 });
  }
}
