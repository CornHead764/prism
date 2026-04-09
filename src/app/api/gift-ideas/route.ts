/**
 * ENDPOINT: /api/gift-ideas
 * - GET:  List gift ideas created by the active user
 * - POST: Create a new gift idea
 *
 * PRIVACY: Only returns ideas created by the authenticated user.
 * Never returns ideas where forUserId === activeUser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { giftIdeas, users } from '@/lib/db/schema';
import { eq, and, asc, ne, sql } from 'drizzle-orm';
import { createGiftIdeaSchema, validateRequest } from '@/lib/validations';
import { getCached, invalidateCache } from '@/lib/cache/redis';
import { logActivity } from '@/lib/services/auditLog';
import { alias } from 'drizzle-orm/pg-core';
import { logError } from '@/lib/utils/logError';

const forUser = alias(users, 'forUser');
const creatorUser = alias(users, 'creatorUser');

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const forUserId = searchParams.get('forUserId');

    const cacheKey = `gift-ideas:${auth.userId}:${forUserId || 'all'}`;

    const data = await getCached(cacheKey, async () => {
      const conditions = [
        eq(giftIdeas.createdBy, auth.userId),
        ne(giftIdeas.forUserId, auth.userId), // Never return ideas for yourself
      ];

      if (forUserId) {
        conditions.push(eq(giftIdeas.forUserId, forUserId));
      }

      const results = await db
        .select({
          id: giftIdeas.id,
          name: giftIdeas.name,
          url: giftIdeas.url,
          notes: giftIdeas.notes,
          price: giftIdeas.price,
          purchased: giftIdeas.purchased,
          purchasedAt: giftIdeas.purchasedAt,
          sortOrder: giftIdeas.sortOrder,
          createdAt: giftIdeas.createdAt,
          forUserId: giftIdeas.forUserId,
          forUserName: forUser.name,
          forUserColor: forUser.color,
          createdById: creatorUser.id,
          createdByName: creatorUser.name,
          createdByColor: creatorUser.color,
        })
        .from(giftIdeas)
        .innerJoin(forUser, eq(giftIdeas.forUserId, forUser.id))
        .innerJoin(creatorUser, eq(giftIdeas.createdBy, creatorUser.id))
        .where(and(...conditions))
        .orderBy(asc(giftIdeas.forUserId), asc(giftIdeas.sortOrder), asc(giftIdeas.createdAt));

      return {
        ideas: results.map((row) => ({
          id: row.id,
          name: row.name,
          url: row.url,
          notes: row.notes,
          price: row.price,
          purchased: row.purchased,
          purchasedAt: row.purchasedAt?.toISOString() || null,
          sortOrder: row.sortOrder,
          createdAt: row.createdAt.toISOString(),
          forUserId: row.forUserId,
          forUser: {
            id: row.forUserId,
            name: row.forUserName,
            color: row.forUserColor,
          },
          createdBy: {
            id: row.createdById,
            name: row.createdByName,
            color: row.createdByColor,
          },
        })),
      };
    }, 60);

    return NextResponse.json(data);
  } catch (error) {
    logError('Error fetching gift ideas:', error);
    return NextResponse.json({ error: 'Failed to fetch gift ideas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { rateLimitGuard } = await import('@/lib/cache/rateLimit');
  const limited = await rateLimitGuard(auth.userId, 'gift-ideas', 30, 60);
  if (limited) return limited;

  try {
    const body = await request.json();

    const validation = validateRequest(createGiftIdeaSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { forUserId, name, url, notes, price } = validation.data;

    // Cannot add gift idea for yourself
    if (forUserId === auth.userId) {
      return NextResponse.json(
        { error: 'Cannot add a gift idea for yourself — use your wish list instead' },
        { status: 400 }
      );
    }

    // Get next sort order
    const [maxSort] = await db
      .select({ max: sql<number>`COALESCE(MAX(${giftIdeas.sortOrder}), -1)` })
      .from(giftIdeas)
      .where(and(eq(giftIdeas.createdBy, auth.userId), eq(giftIdeas.forUserId, forUserId)));

    const [newIdea] = await db
      .insert(giftIdeas)
      .values({
        createdBy: auth.userId,
        forUserId,
        name,
        url: url || null,
        notes: notes || null,
        price: price || null,
        sortOrder: (maxSort?.max ?? -1) + 1,
      })
      .returning();

    if (!newIdea) {
      return NextResponse.json({ error: 'Failed to create gift idea' }, { status: 500 });
    }

    await invalidateCache(`gift-ideas:${auth.userId}:*`);

    logActivity({
      userId: auth.userId,
      action: 'create',
      entityType: 'gift_idea',
      entityId: newIdea.id,
      summary: `Added gift idea: ${name}`,
    });

    return NextResponse.json({
      id: newIdea.id,
      name: newIdea.name,
      url: newIdea.url,
      notes: newIdea.notes,
      price: newIdea.price,
      purchased: newIdea.purchased,
      sortOrder: newIdea.sortOrder,
      forUserId: newIdea.forUserId,
      createdAt: newIdea.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    logError('Error creating gift idea:', error);
    return NextResponse.json({ error: 'Failed to create gift idea' }, { status: 500 });
  }
}
