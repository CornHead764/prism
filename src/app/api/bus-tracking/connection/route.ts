import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { apiCredentials } from '@/lib/db/schema';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const cred = await db.query.apiCredentials.findFirst({
      where: (c, { eq }) => eq(c.service, 'gmail-bus'),
    });

    return NextResponse.json({
      connected: !!cred,
      expiresAt: cred?.expiresAt || null,
      updatedAt: cred?.updatedAt || null,
    });
  } catch (error) {
    logError('Failed to check Gmail connection:', error);
    return NextResponse.json({ error: 'Failed to check connection' }, { status: 500 });
  }
}

export async function DELETE() {
  return withAuth(async (auth) => {
    try {
      const cred = await db.query.apiCredentials.findFirst({
        where: (c, { eq }) => eq(c.service, 'gmail-bus'),
      });

      if (!cred) {
        return NextResponse.json({ error: 'Gmail not connected' }, { status: 404 });
      }

      await db.delete(apiCredentials).where(eq(apiCredentials.id, cred.id));

      logActivity({
        userId: auth.userId,
        action: 'delete',
        entityType: 'integration',
        summary: 'Disconnected Gmail for bus tracking',
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      logError('Failed to disconnect Gmail:', error);
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }
  }, { permission: 'canModifySettings' });
}
