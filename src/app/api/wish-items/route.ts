/**
 *
 * ENDPOINT: /api/wish-items
 * - GET:  List wish items for a family member
 * - POST: Create a new wish item
 *
 * QUERY PARAMETERS (GET):
 * - memberId: Whose wish list to fetch (required)
 * - viewerId: Who is viewing — if same as memberId, claim info is hidden (secret claims)
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { wishItems, users } from '@/lib/db/schema';
import { eq, asc, sql } from 'drizzle-orm';
import { createWishItemSchema, validateRequest } from '@/lib/validations';
import { invalidateCache } from '@/lib/cache/redis';
import { logActivity } from '@/lib/services/auditLog';
import { formatWishItemRow } from '@/lib/utils/formatters';
import { logError } from '@/lib/utils/logError';

// Alias for claimedBy user join
import { alias } from 'drizzle-orm/pg-core';
const claimedByUser = alias(users, 'claimedByUser');
const addedByUser = alias(users, 'addedByUser');

/**
 * GET /api/wish-items
 * Lists wish items for a family member. Secret claims: if viewerId === memberId,
 * claim info is stripped from the response.
 */
export async function GET(request: NextRequest) {
  // Allow unauthenticated reads (dashboard/screensaver display)
  const auth = await getDisplayAuth();

  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const viewerId = searchParams.get('viewerId');

    const baseQuery = db
      .select({
        id: wishItems.id,
        memberId: wishItems.memberId,
        name: wishItems.name,
        url: wishItems.url,
        notes: wishItems.notes,
        sortOrder: wishItems.sortOrder,
        claimed: wishItems.claimed,
        claimedAt: wishItems.claimedAt,
        claimedById: claimedByUser.id,
        claimedByName: claimedByUser.name,
        claimedByColor: claimedByUser.color,
        addedById: addedByUser.id,
        addedByName: addedByUser.name,
        addedByColor: addedByUser.color,
        createdAt: wishItems.createdAt,
      })
      .from(wishItems)
      .leftJoin(claimedByUser, eq(wishItems.claimedBy, claimedByUser.id))
      .leftJoin(addedByUser, eq(wishItems.addedBy, addedByUser.id))
      .orderBy(asc(wishItems.sortOrder), asc(wishItems.createdAt));

    const results = memberId
      ? await baseQuery.where(eq(wishItems.memberId, memberId))
      : await baseQuery;

    const formattedItems = results.map(item => {
      const isOwnerViewing = viewerId === item.memberId;
      return formatWishItemRow(item, isOwnerViewing);
    });

    return NextResponse.json({ items: formattedItems });
  } catch (error) {
    logError('Error fetching wish items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wish items' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wish-items
 * Creates a new wish item on a member's list.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { rateLimitGuard } = await import('@/lib/cache/rateLimit');
  const limited = await rateLimitGuard(auth.userId, 'wish-items', 30, 60);
  if (limited) return limited;

  try {
    const body = await request.json();

    const validation = validateRequest(createWishItemSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { memberId, name, url, notes, addedBy } = validation.data;

    // Get next sort order
    const [maxSort] = await db
      .select({ max: sql<number>`COALESCE(MAX(${wishItems.sortOrder}), -1)` })
      .from(wishItems)
      .where(eq(wishItems.memberId, memberId));

    const [newItem] = await db
      .insert(wishItems)
      .values({
        memberId,
        name,
        url: url || null,
        notes: notes || null,
        sortOrder: (maxSort?.max ?? -1) + 1,
        addedBy: addedBy || null,
      })
      .returning();

    if (!newItem) {
      return NextResponse.json(
        { error: 'Failed to create wish item' },
        { status: 500 }
      );
    }

    await invalidateCache('wish-items:*');

    logActivity({
      userId: auth.userId,
      action: 'create',
      entityType: 'wish_item',
      entityId: newItem.id,
      summary: `Added wish item: ${name}`,
    });

    return NextResponse.json({
      id: newItem.id,
      memberId: newItem.memberId,
      name: newItem.name,
      url: newItem.url,
      notes: newItem.notes,
      sortOrder: newItem.sortOrder,
      claimed: newItem.claimed,
      createdAt: newItem.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    logError('Error creating wish item:', error);
    return NextResponse.json(
      { error: 'Failed to create wish item' },
      { status: 500 }
    );
  }
}
