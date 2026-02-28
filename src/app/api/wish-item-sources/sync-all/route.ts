import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { wishItemSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { invalidateCache } from '@/lib/cache/redis';
import { logActivity } from '@/lib/services/auditLog';
import type { SyncResult } from '@/lib/integrations/wish-items/types';

/**
 * POST /api/wish-item-sources/sync-all
 *
 * Syncs all enabled wish item sources by delegating to each source's
 * individual sync endpoint (which handles token refresh internally).
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  try {
    const sources = await db
      .select()
      .from(wishItemSources)
      .where(eq(wishItemSources.syncEnabled, true));

    if (sources.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        message: 'No enabled wish item sources to sync',
      });
    }

    const results: Array<{
      sourceId: string;
      provider: string;
      success: boolean;
      result?: SyncResult;
      error?: string;
    }> = [];

    for (const source of sources) {
      try {
        const syncResponse = await fetch(
          `${process.env.BASE_URL || 'http://localhost:3000'}/api/wish-item-sources/${source.id}/sync`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: request.headers.get('cookie') || '',
            },
          }
        );

        if (syncResponse.ok) {
          const syncResult = await syncResponse.json();
          results.push({
            sourceId: source.id,
            provider: source.provider,
            success: true,
            result: syncResult,
          });
        } else {
          const errorData = await syncResponse.json();
          results.push({
            sourceId: source.id,
            provider: source.provider,
            success: false,
            error: errorData.error || 'Sync failed',
          });
        }
      } catch (error) {
        results.push({
          sourceId: source.id,
          provider: source.provider,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    await invalidateCache('wish:*');
    await invalidateCache('wish-item-sources:*');

    const successCount = results.filter(r => r.success).length;

    logActivity({
      userId: auth.userId,
      action: 'sync',
      entityType: 'integration',
      summary: `Synced all wish item sources: ${successCount}/${sources.length} succeeded`,
    });

    return NextResponse.json({
      success: true,
      synced: successCount,
      total: sources.length,
      results,
    });
  } catch (error) {
    console.error('Wish sync-all error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
