import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { wishItemSources, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { invalidateCache, getCached } from '@/lib/cache/redis';
import { logActivity } from '@/lib/services/auditLog';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const cacheKey = userId ? `wish-item-sources:user:${userId}` : 'wish-item-sources:all';

    const sources = await getCached(
      cacheKey,
      async () => {
        const memberUser = db.$with('member_user').as(
          db.select({ id: users.id, name: users.name }).from(users)
        );

        let query = db
          .select({
            id: wishItemSources.id,
            userId: wishItemSources.userId,
            userName: users.name,
            provider: wishItemSources.provider,
            externalListId: wishItemSources.externalListId,
            externalListName: wishItemSources.externalListName,
            memberId: wishItemSources.memberId,
            syncEnabled: wishItemSources.syncEnabled,
            lastSyncAt: wishItemSources.lastSyncAt,
            lastSyncError: wishItemSources.lastSyncError,
            createdAt: wishItemSources.createdAt,
          })
          .from(wishItemSources)
          .leftJoin(users, eq(wishItemSources.userId, users.id));

        if (userId) {
          query = query.where(eq(wishItemSources.userId, userId)) as typeof query;
        }

        const rows = await query;

        // Fetch member names for each source
        const memberIds = [...new Set(rows.map(r => r.memberId))];
        const members = memberIds.length > 0
          ? await db.select({ id: users.id, name: users.name }).from(users)
          : [];
        const memberMap = new Map(members.map(m => [m.id, m.name]));

        return rows.map(r => ({
          ...r,
          memberName: memberMap.get(r.memberId) || null,
        }));
      },
      120
    );

    return NextResponse.json(sources);
  } catch (error) {
    console.error('Error fetching wish item sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wish item sources' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  try {
    const body = await request.json();

    if (!body.provider || !body.externalListId || !body.memberId) {
      return NextResponse.json(
        { error: 'provider, externalListId, and memberId are required' },
        { status: 400 }
      );
    }

    // Verify the member exists
    const [member] = await db
      .select()
      .from(users)
      .where(eq(users.id, body.memberId));

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Check for duplicate source
    const [existing] = await db
      .select()
      .from(wishItemSources)
      .where(
        and(
          eq(wishItemSources.userId, body.userId || auth.userId),
          eq(wishItemSources.provider, body.provider),
          eq(wishItemSources.externalListId, body.externalListId)
        )
      );

    if (existing) {
      return NextResponse.json(
        { error: 'This external list is already connected' },
        { status: 409 }
      );
    }

    const [newSource] = await db
      .insert(wishItemSources)
      .values({
        userId: body.userId || auth.userId,
        provider: body.provider,
        externalListId: body.externalListId,
        externalListName: body.externalListName || null,
        memberId: body.memberId,
        syncEnabled: body.syncEnabled !== false,
        accessToken: body.accessToken || null,
        refreshToken: body.refreshToken || null,
        tokenExpiresAt: body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : null,
      })
      .returning();

    if (!newSource) {
      return NextResponse.json(
        { error: 'Failed to create wish item source' },
        { status: 500 }
      );
    }

    await invalidateCache('wish-item-sources:*');

    logActivity({
      userId: auth.userId,
      action: 'create',
      entityType: 'integration',
      entityId: newSource.id,
      summary: `Connected wish list sync: ${newSource.provider} (${newSource.externalListName || newSource.externalListId})`,
    });

    return NextResponse.json({
      id: newSource.id,
      userId: newSource.userId,
      provider: newSource.provider,
      externalListId: newSource.externalListId,
      externalListName: newSource.externalListName,
      memberId: newSource.memberId,
      syncEnabled: newSource.syncEnabled,
      lastSyncAt: newSource.lastSyncAt,
      createdAt: newSource.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating wish item source:', error);
    return NextResponse.json(
      { error: 'Failed to create wish item source' },
      { status: 500 }
    );
  }
}
