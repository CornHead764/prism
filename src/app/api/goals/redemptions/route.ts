import { NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { goalRedemptions, goals, users } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { logError } from '@/lib/utils/logError';

/**
 * GET /api/goals/redemptions
 *
 * Returns the most recent goal redemptions (capped) with goal + child names
 * so the /goals UI can display a redemption history list.
 */
export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ redemptions: [] });
  }

  try {
    const rows = await db
      .select({
        id: goalRedemptions.id,
        goalId: goalRedemptions.goalId,
        goalName: goals.name,
        goalEmoji: goals.emoji,
        userId: goalRedemptions.userId,
        userName: users.name,
        userColor: users.color,
        pointsCost: goalRedemptions.pointsCost,
        notes: goalRedemptions.notes,
        redeemedAt: goalRedemptions.redeemedAt,
      })
      .from(goalRedemptions)
      .leftJoin(goals, eq(goalRedemptions.goalId, goals.id))
      .leftJoin(users, eq(goalRedemptions.userId, users.id))
      .orderBy(desc(goalRedemptions.redeemedAt))
      .limit(50);

    return NextResponse.json({
      redemptions: rows.map((r) => ({
        ...r,
        redeemedAt: r.redeemedAt.toISOString(),
      })),
    });
  } catch (error) {
    logError('Error fetching redemptions:', error);
    return NextResponse.json({ error: 'Failed to fetch redemptions' }, { status: 500 });
  }
}
