/**
 *
 * ENDPOINT: /api/calendar-notes
 * - GET: List notes for a date range
 * - PUT: Upsert a note for a specific date
 *
 * QUERY PARAMETERS (GET):
 * - from: Start date (YYYY-MM-DD)
 * - to:   End date (YYYY-MM-DD)
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { calendarNotes } from '@/lib/db/schema';
import { gte, lte, and, eq, asc } from 'drizzle-orm';
import { upsertCalendarNoteSchema, calendarNotesQuerySchema } from '@/lib/validations';
import { getCached, invalidateCache } from '@/lib/cache/redis';

/**
 * GET /api/calendar-notes?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ notes: [] });
  }

  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const parsed = calendarNotesQuerySchema.safeParse({ from, to });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const cacheKey = `calendar-notes:${parsed.data.from}:${parsed.data.to}`;

    const data = await getCached(cacheKey, async () => {
      const rows = await db
        .select({
          id: calendarNotes.id,
          date: calendarNotes.date,
          content: calendarNotes.content,
          createdBy: calendarNotes.createdBy,
          createdAt: calendarNotes.createdAt,
          updatedAt: calendarNotes.updatedAt,
        })
        .from(calendarNotes)
        .where(
          and(
            gte(calendarNotes.date, parsed.data.from),
            lte(calendarNotes.date, parsed.data.to)
          )
        )
        .orderBy(asc(calendarNotes.date));

      return { notes: rows };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch calendar notes:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

/**
 * PUT /api/calendar-notes
 * Upsert a note for a date. Empty content deletes the note.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { rateLimitGuard } = await import('@/lib/cache/rateLimit');
  const limited = await rateLimitGuard(auth.userId, 'calendar-notes', 60, 60);
  if (limited) return limited;

  try {
    const body = await request.json();
    const parsed = upsertCalendarNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { date, content } = parsed.data;

    // Empty content = delete the note
    if (!content.trim()) {
      await db.delete(calendarNotes).where(eq(calendarNotes.date, date));
      await invalidateCache('calendar-notes:*');
      return NextResponse.json({ deleted: true, date });
    }

    // Upsert
    const [note] = await db
      .insert(calendarNotes)
      .values({
        date,
        content,
        createdBy: auth.userId,
      })
      .onConflictDoUpdate({
        target: calendarNotes.date,
        set: {
          content,
          createdBy: auth.userId,
          updatedAt: new Date(),
        },
      })
      .returning();

    await invalidateCache('calendar-notes:*');

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Failed to upsert calendar note:', error);
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
  }
}
