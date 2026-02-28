import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { wishItemSources, wishItems } from '@/lib/db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { invalidateCache } from '@/lib/cache/redis';
import { getWishItemProvider } from '@/lib/integrations/wish-items';
import { decrypt, encrypt } from '@/lib/utils/crypto';
import { logActivity } from '@/lib/services/auditLog';
import type {
  WishItemProviderTokens,
  ExternalWishItem,
  SyncResult,
} from '@/lib/integrations/wish-items/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/wish-item-sources/[id]/sync
 *
 * Performs bidirectional sync between Prism wish items and the external provider.
 *
 * Sync strategy (newest_wins):
 * 1. Fetch all remote items from provider
 * 2. For each remote item:
 *    - If no local match by externalId: create local item
 *    - If local match exists: compare timestamps, update the older one
 * 3. For each local item linked to this source:
 *    - If no remote match: push to remote (item was created locally)
 *    - If deleted remotely: delete locally
 * 4. Update lastSyncAt timestamp
 *
 * IMPORTANT: Claims (claimed, claimedBy, claimedAt) are local-only and NEVER
 * sent to or affected by the external provider.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  const { id: sourceId } = await params;

  try {
    // 1. Get the source configuration
    const [source] = await db
      .select()
      .from(wishItemSources)
      .where(eq(wishItemSources.id, sourceId));

    if (!source) {
      return NextResponse.json(
        { error: 'Wish item source not found' },
        { status: 404 }
      );
    }

    if (!source.syncEnabled) {
      return NextResponse.json(
        { error: 'Sync is disabled for this source' },
        { status: 400 }
      );
    }

    // 2. Get the provider
    const provider = getWishItemProvider(source.provider);
    if (!provider) {
      return NextResponse.json(
        { error: `Unknown provider: ${source.provider}` },
        { status: 400 }
      );
    }

    // 3. Prepare tokens (decrypt from storage)
    if (!source.accessToken) {
      return NextResponse.json(
        { error: 'No access token configured. Please reconnect the provider.' },
        { status: 401 }
      );
    }

    let tokens: WishItemProviderTokens = {
      accessToken: decrypt(source.accessToken),
      refreshToken: source.refreshToken ? decrypt(source.refreshToken) : undefined,
      expiresAt: source.tokenExpiresAt || undefined,
    };

    // 4. Refresh tokens if expired
    if (tokens.expiresAt && new Date(tokens.expiresAt) < new Date()) {
      if (provider.refreshTokens && tokens.refreshToken) {
        const newTokens = await provider.refreshTokens(tokens);
        if (newTokens) {
          tokens = newTokens;
          await db
            .update(wishItemSources)
            .set({
              accessToken: encrypt(newTokens.accessToken),
              refreshToken: newTokens.refreshToken ? encrypt(newTokens.refreshToken) : source.refreshToken,
              tokenExpiresAt: newTokens.expiresAt,
              updatedAt: new Date(),
            })
            .where(eq(wishItemSources.id, sourceId));
        } else {
          await db
            .update(wishItemSources)
            .set({
              lastSyncError: 'Token refresh failed. Please reconnect.',
              updatedAt: new Date(),
            })
            .where(eq(wishItemSources.id, sourceId));

          return NextResponse.json(
            { error: 'Token refresh failed. Please reconnect the provider.' },
            { status: 401 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Access token expired. Please reconnect the provider.' },
          { status: 401 }
        );
      }
    }

    // 5. Perform the sync
    const result = await performSync(
      source.id,
      source.externalListId,
      source.memberId,
      tokens,
      provider
    );

    // 6. Update source with sync result
    await db
      .update(wishItemSources)
      .set({
        lastSyncAt: new Date(),
        lastSyncError: result.errors.length > 0 ? result.errors.join('; ') : null,
        updatedAt: new Date(),
      })
      .where(eq(wishItemSources.id, sourceId));

    await invalidateCache('wish:*');
    await invalidateCache('wish-item-sources:*');

    logActivity({
      userId: auth.userId,
      action: 'sync',
      entityType: 'integration',
      entityId: sourceId,
      summary: `Synced wish item source: ${source.provider} (${source.externalListName || source.externalListId}) - ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Wish item sync error:', error);

    await db
      .update(wishItemSources)
      .set({
        lastSyncError: error instanceof Error ? error.message : 'Unknown sync error',
        updatedAt: new Date(),
      })
      .where(eq(wishItemSources.id, sourceId));

    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Build the body content for a remote task from wish item notes and URL.
 * Appends URL as "\n\nLink: <url>" if present.
 */
function buildRemoteBody(notes: string | null, url: string | null): string | null {
  const parts: string[] = [];
  if (notes) parts.push(notes);
  if (url) parts.push(`Link: ${url}`);
  return parts.length > 0 ? parts.join('\n\n') : null;
}

/**
 * Parse the body content from a remote task to extract notes and URL.
 */
function parseRemoteBody(body: string | null | undefined): { notes: string | null; url: string | null } {
  if (!body) return { notes: null, url: null };

  const urlMatch = body.match(/\n\nLink: (https?:\/\/\S+)$/);
  if (urlMatch && urlMatch[1]) {
    const notes = body.slice(0, urlMatch.index) || null;
    return { notes, url: urlMatch[1] };
  }

  return { notes: body, url: null };
}

/**
 * Core sync logic
 */
async function performSync(
  sourceId: string,
  externalListId: string,
  memberId: string,
  tokens: WishItemProviderTokens,
  provider: ReturnType<typeof getWishItemProvider>
): Promise<SyncResult> {
  if (!provider) {
    throw new Error('Provider not found');
  }

  const result: SyncResult = {
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  };

  try {
    // Fetch remote items
    const remoteItems = await provider.fetchItems(tokens, externalListId);

    // Fetch local items belonging to this member (linked to this source OR unlinked)
    const localItems = await db
      .select()
      .from(wishItems)
      .where(
        and(
          eq(wishItems.memberId, memberId),
          or(
            eq(wishItems.wishItemSourceId, sourceId),
            isNull(wishItems.wishItemSourceId)
          )
        )
      );

    // Create maps for quick lookup
    const remoteById = new Map(remoteItems.map(i => [i.id, i]));
    const localByExternalId = new Map(
      localItems
        .filter(i => i.externalId)
        .map(i => [i.externalId!, i])
    );

    // Process remote items
    for (const remoteItem of remoteItems) {
      const localItem = localByExternalId.get(remoteItem.id);
      const { notes: remoteNotes, url: remoteUrl } = parseRemoteBody(remoteItem.notes);

      if (!localItem) {
        // Remote item doesn't exist locally - create it
        try {
          await db.insert(wishItems).values({
            memberId,
            name: remoteItem.name,
            notes: remoteNotes,
            url: remoteUrl,
            wishItemSourceId: sourceId,
            externalId: remoteItem.id,
            externalUpdatedAt: remoteItem.updatedAt,
          });
          result.created++;
        } catch (err) {
          result.errors.push(`Failed to create local item: ${remoteItem.name}`);
        }
      } else {
        // Item exists in both - compare timestamps
        const remoteUpdated = remoteItem.updatedAt;
        const localUpdated = localItem.updatedAt;

        if (remoteUpdated > localUpdated) {
          // Remote is newer - update local (NEVER touch claims)
          try {
            await db
              .update(wishItems)
              .set({
                name: remoteItem.name,
                notes: remoteNotes,
                url: remoteUrl,
                externalUpdatedAt: remoteItem.updatedAt,
                updatedAt: new Date(),
              })
              .where(eq(wishItems.id, localItem.id));
            result.updated++;
          } catch (err) {
            result.errors.push(`Failed to update local item: ${localItem.name}`);
          }
        } else if (localUpdated > remoteUpdated) {
          // Local is newer - update remote
          try {
            const bodyContent = buildRemoteBody(localItem.notes, localItem.url);
            await provider.updateItem(tokens, remoteItem.id, externalListId, {
              name: localItem.name,
              notes: bodyContent,
            });

            await db
              .update(wishItems)
              .set({
                updatedAt: new Date(),
              })
              .where(eq(wishItems.id, localItem.id));
            result.updated++;
          } catch (err) {
            result.errors.push(`Failed to update remote item: ${localItem.name}`);
          }
        }
      }
    }

    // Find local items that don't exist remotely (created locally or deleted remotely)
    for (const localItem of localItems) {
      if (!localItem.externalId) {
        // Local item without externalId - push to remote
        try {
          const bodyContent = buildRemoteBody(localItem.notes, localItem.url);
          const created = await provider.createItem(tokens, {
            listId: externalListId,
            name: localItem.name,
            notes: bodyContent,
          });

          // Update local item with external ID and link to this source
          await db
            .update(wishItems)
            .set({
              wishItemSourceId: sourceId,
              externalId: created.id,
              externalUpdatedAt: created.updatedAt,
              updatedAt: new Date(),
            })
            .where(eq(wishItems.id, localItem.id));
          result.created++;
        } catch (err) {
          result.errors.push(`Failed to push item to remote: ${localItem.name}`);
        }
      } else if (!remoteById.has(localItem.externalId)) {
        // Local item has externalId but remote doesn't have it - deleted remotely
        try {
          await db.delete(wishItems).where(eq(wishItems.id, localItem.id));
          result.deleted++;
        } catch (err) {
          result.errors.push(`Failed to delete local item: ${localItem.name}`);
        }
      }
    }

    return result;
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'Unknown sync error');
    return result;
  }
}
