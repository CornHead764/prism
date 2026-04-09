import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { getRedisClient } from '@/lib/cache/getRedisClient';
import { googleTasksProvider } from '@/lib/integrations/tasks/google-tasks';
import { logError } from '@/lib/utils/logError';

/**
 * GET /api/task-sources/google-lists
 * Fetch Google Tasks lists using temporary OAuth tokens from Redis.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageIntegrations');
  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const taskListId = searchParams.get('taskListId');

    const redis = await getRedisClient();
    if (!redis) {
      return NextResponse.json({ error: 'Redis unavailable' }, { status: 500 });
    }

    // Try to find temp tokens
    const tempKey = taskListId
      ? `google-tasks-temp:${auth.userId}:task:${taskListId}`
      : `google-tasks-temp:${auth.userId}:task:new`;

    const tempData = await redis.get(tempKey);
    if (!tempData) {
      return NextResponse.json(
        { error: 'Temporary tokens expired. Please reconnect Google Tasks.' },
        { status: 401 }
      );
    }

    const { rawAccessToken } = JSON.parse(tempData);

    const lists = await googleTasksProvider.fetchLists({
      accessToken: rawAccessToken,
    });

    return NextResponse.json({ lists });
  } catch (error) {
    logError('Error fetching Google Tasks lists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Google Tasks lists' },
      { status: 500 }
    );
  }
}
