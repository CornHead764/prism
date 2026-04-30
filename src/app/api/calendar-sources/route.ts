/**
 * Endpoint: /api/calendar-sources
 *
 * POST: Create a calendar source. Currently only iCal subscription sources
 *       are accepted here — Google sources are created automatically when
 *       their OAuth flow completes, and local calendars use POST /api/calendars.
 *
 * The setup wizard's CalendarStep posts to this endpoint, so during the
 * initial-setup window (before /api/setup/complete has been called) we
 * accept unauthenticated POSTs in the same way /api/family does. After
 * setup, callers must be a parent with canManageIntegrations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { calendarSources, settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';
import { syncIcalCalendarSource } from '@/lib/services/calendar-sync';

async function setupIsComplete(): Promise<boolean> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, 'setupComplete'));
    return !!row;
  } catch {
    return false;
  }
}

function isValidIcalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'webcal:';
  } catch {
    return false;
  }
}

// webcal:// is just an iCal feed served over http(s); node-ical doesn't
// recognize the scheme, so we normalize it before storing.
function normalizeIcalUrl(url: string): string {
  if (url.startsWith('webcal://')) return 'https://' + url.slice('webcal://'.length);
  return url;
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    const allowUnauthedSetup = !(await setupIsComplete());
    if (!allowUnauthedSetup) return authResult;
  } else {
    const forbidden = requireRole(authResult, 'canManageIntegrations');
    if (forbidden) return forbidden;
  }

  try {
    const body = await request.json();

    if (body.type && body.type !== 'ical') {
      return NextResponse.json(
        { error: `Unsupported source type "${body.type}"; only "ical" is currently supported here` },
        { status: 400 }
      );
    }

    if (!body.url || typeof body.url !== 'string' || !isValidIcalUrl(body.url)) {
      return NextResponse.json(
        { error: 'A valid http, https, or webcal URL is required' },
        { status: 400 }
      );
    }

    const icalUrl = normalizeIcalUrl(body.url.trim());
    const displayName = (typeof body.name === 'string' ? body.name : '').trim() || 'iCal Calendar';

    const [created] = await db
      .insert(calendarSources)
      .values({
        provider: 'ical',
        sourceCalendarId: `ical_${Date.now()}`,
        dashboardCalendarName: displayName,
        displayName,
        icalUrl,
        enabled: true,
        // iCal subscriptions are read-only; don't offer them as create-event targets.
        showInEventModal: false,
      })
      .returning();

    if (!created) {
      return NextResponse.json(
        { error: 'Failed to create calendar source' },
        { status: 500 }
      );
    }

    // Initial sync runs in the background — don't block the response.
    // Errors here just get logged; persistent failures will surface on the
    // calendar source's syncErrors field on subsequent scheduled syncs.
    void syncIcalCalendarSource(created.id)
      .then(() => invalidateEntity('events'))
      .catch((err) => {
        logError(`[calendar-sources] initial sync for ${created.id} failed:`, err);
      });

    return NextResponse.json(
      {
        id: created.id,
        provider: created.provider,
        displayName: created.displayName,
        icalUrl: created.icalUrl,
        enabled: created.enabled,
        createdAt: created.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    logError('Error creating calendar source:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar source' },
      { status: 500 }
    );
  }
}
