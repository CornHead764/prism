/**
 *
 * ENDPOINT: /api/wish-items/[id]/claim
 * - POST: Claim or unclaim a wish item
 *
 * REQUEST BODY:
 * { claimedBy: string }  → claim the item
 * { claimedBy: null }    → unclaim the item
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { wishItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';
import { invalidateCache } from '@/lib/cache/redis';
import { logError } from '@/lib/utils/logError';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/wish-items/[id]/claim
 * Toggle claim on a wish item.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const { claimedBy } = body;

    const [existing] = await db
      .select({
        id: wishItems.id,
        memberId: wishItems.memberId,
        claimed: wishItems.claimed,
        claimedBy: wishItems.claimedBy,
      })
      .from(wishItems)
      .where(eq(wishItems.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: 'Wish item not found' },
        { status: 404 }
      );
    }

    // If already claimed by someone else, prevent double-claim
    if (claimedBy && existing.claimed && existing.claimedBy !== claimedBy) {
      // If the owner is trying to self-claim but someone already got it, give a friendly message
      const isSelfClaim = claimedBy === existing.memberId;
      return NextResponse.json(
        { error: isSelfClaim
            ? 'Someone already got this for you!'
            : 'This item has already been claimed by someone else',
          alreadyPurchased: isSelfClaim,
        },
        { status: 409 }
      );
    }

    if (claimedBy) {
      // Claim the item
      await db.update(wishItems).set({
        claimed: true,
        claimedBy,
        claimedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(wishItems.id, id));
    } else {
      // Unclaim the item — only the claimer or a parent can unclaim
      if (existing.claimedBy !== auth.userId && auth.role !== 'parent') {
        return NextResponse.json(
          { error: 'Only the person who claimed this or a parent can unclaim it' },
          { status: 403 }
        );
      }
      await db.update(wishItems).set({
        claimed: false,
        claimedBy: null,
        claimedAt: null,
        updatedAt: new Date(),
      }).where(eq(wishItems.id, id));
    }

    await invalidateCache('wish-items:*');

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Error claiming wish item:', error);
    return NextResponse.json(
      { error: 'Failed to claim wish item' },
      { status: 500 }
    );
  }
}
