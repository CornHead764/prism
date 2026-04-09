import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { calendarSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    await db
      .delete(calendarSources)
      .where(eq(calendarSources.provider, 'google'));

    logActivity({
      userId: auth.userId,
      action: 'delete',
      entityType: 'integration',
      summary: 'Disconnected Google Calendar integration',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Error disconnecting Google:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Google' },
      { status: 500 }
    );
  }
}
