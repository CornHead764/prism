import { NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { calendarSources, taskSources, shoppingListSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logError } from '@/lib/utils/logError';

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    // Google: check calendar_sources with provider='google'
    const googleSources = await db
      .select({
        id: calendarSources.id,
        accessToken: calendarSources.accessToken,
        lastSynced: calendarSources.lastSynced,
        syncErrors: calendarSources.syncErrors,
      })
      .from(calendarSources)
      .where(eq(calendarSources.provider, 'google'));

    const googleConnected = googleSources.some((s) => s.accessToken);
    const googleExpired = googleSources.some(
      (s) => s.syncErrors && (s.syncErrors as Record<string, unknown>).needsReauth
    );
    const lastSyncedDates = googleSources
      .map((s) => s.lastSynced)
      .filter(Boolean)
      .sort((a, b) => (b!.getTime() - a!.getTime()));

    // Google Tasks: check task_sources with provider='google_tasks'
    const googleTaskSources = await db
      .select({ id: taskSources.id })
      .from(taskSources)
      .where(eq(taskSources.provider, 'google_tasks'));

    // Microsoft: check task_sources and shopping_list_sources with provider='microsoft_todo'
    const msTaskSources = await db
      .select({ id: taskSources.id })
      .from(taskSources)
      .where(eq(taskSources.provider, 'microsoft_todo'));

    const msShoppingSources = await db
      .select({ id: shoppingListSources.id })
      .from(shoppingListSources)
      .where(eq(shoppingListSources.provider, 'microsoft_todo'));

    const microsoftConnected = msTaskSources.length > 0 || msShoppingSources.length > 0;

    return NextResponse.json({
      google: {
        connected: googleConnected || googleTaskSources.length > 0,
        expired: googleExpired,
        calendarCount: googleSources.length,
        taskSourceCount: googleTaskSources.length,
        lastSynced: lastSyncedDates[0]?.toISOString() || null,
      },
      microsoft: {
        connected: microsoftConnected,
        taskSourceCount: msTaskSources.length,
        shoppingSourceCount: msShoppingSources.length,
      },
    });
  } catch (error) {
    logError('Error fetching integration status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integration status' },
      { status: 500 }
    );
  }
}
