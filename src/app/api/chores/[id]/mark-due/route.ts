import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { chores } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';
import { format } from 'date-fns';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/chores/[id]/mark-due
 *
 * Parent-only. Pulls a chore's nextDue forward to today so it can be completed
 * ad hoc (e.g. weekly chore that needs an extra run). The complete button on
 * the client uses nextDue to gate re-completion, so this re-enables it.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageChores');
  if (forbidden) return forbidden;

  try {
    const { id: choreId } = await params;

    const [chore] = await db
      .select({ id: chores.id, title: chores.title, nextDue: chores.nextDue })
      .from(chores)
      .where(eq(chores.id, choreId));

    if (!chore) {
      return NextResponse.json({ error: 'Chore not found' }, { status: 404 });
    }

    const today = format(new Date(), 'yyyy-MM-dd');

    await db
      .update(chores)
      .set({ nextDue: today, updatedAt: new Date() })
      .where(eq(chores.id, choreId));

    await invalidateEntity('chores');

    logActivity({
      userId: auth.userId,
      action: 'mark-due',
      entityType: 'chore',
      entityId: choreId,
      summary: `Marked chore due: ${chore.title}`,
    });

    return NextResponse.json({ id: choreId, nextDue: today });
  } catch (error) {
    logError('Error marking chore due:', error);
    return NextResponse.json({ error: 'Failed to mark chore due' }, { status: 500 });
  }
}
