import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { goals, goalAchievements, goalRedemptions, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/goals/[id]/redeem
 *
 * Records a goal redemption (audit trail) and resets the goal's progress so it
 * can be earned again. Body: { userId: string (child), notes?: string }.
 * If userId is omitted, behaves like the legacy reset (no redemption row written).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageGoals');
  if (forbidden) return forbidden;

  try {
    const { id: goalId } = await params;
    const body = await request.json().catch(() => ({}));
    const userId: string | undefined = typeof body?.userId === 'string' ? body.userId : undefined;
    const notes: string | undefined = typeof body?.notes === 'string' && body.notes.trim() ? body.notes.trim() : undefined;

    const [goal] = await db
      .select()
      .from(goals)
      .where(eq(goals.id, goalId));

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    if (userId) {
      const [child] = await db
        .select({ id: users.id, role: users.role, name: users.name })
        .from(users)
        .where(eq(users.id, userId));
      if (!child) {
        return NextResponse.json({ error: 'Child not found' }, { status: 404 });
      }
      if (child.role !== 'child') {
        return NextResponse.json({ error: 'Only child accounts can redeem goals' }, { status: 400 });
      }
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      if (userId) {
        await tx.insert(goalRedemptions).values({
          goalId,
          userId,
          redeemedByParent: auth.userId,
          pointsCost: goal.pointCost,
          notes: notes ?? null,
          redeemedAt: now,
        });
      }

      // Wipe achievement records (legacy table) and bump lastResetAt so the
      // GET /api/goals waterfall post-processor treats progress as zero again.
      await tx
        .delete(goalAchievements)
        .where(eq(goalAchievements.goalId, goalId));

      await tx
        .update(goals)
        .set({ lastResetAt: now, updatedAt: now })
        .where(eq(goals.id, goalId));
    });

    await invalidateEntity('goals');
    await invalidateEntity('points');

    logActivity({
      userId: auth.userId,
      action: userId ? 'redeem' : 'reset',
      entityType: 'goal',
      entityId: goalId,
      summary: userId ? `Redeemed goal: ${goal.name}` : `Reset goal: ${goal.name}`,
    });

    return NextResponse.json({
      message: userId
        ? `Goal "${goal.name}" redeemed. Progress starts over.`
        : `Goal "${goal.name}" has been reset.`,
    });
  } catch (error) {
    logError('Error redeeming goal:', error);
    return NextResponse.json({ error: 'Failed to redeem goal' }, { status: 500 });
  }
}
