import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

const WIFI_SETTINGS_KEY = 'wifiConfig';

/**
 * GET /api/settings/wifi - Get WiFi configuration (requires auth; shown on babysitter page after PIN unlock)
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await db
      .select()
      .from(settings)
      .where(eq(settings.key, WIFI_SETTINGS_KEY))
      .limit(1);

    const config = result[0]?.value || null;

    return NextResponse.json({ config });
  } catch (error) {
    logError('Error fetching WiFi config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch WiFi config' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/wifi - Save WiFi configuration
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const forbidden = requireRole(auth, 'canModifySettings');
    if (forbidden) return forbidden;

    const body = await request.json();
    const { ssid, password, securityType, hidden } = body;

    if (!ssid) {
      return NextResponse.json(
        { error: 'SSID is required' },
        { status: 400 }
      );
    }

    const config = {
      ssid: ssid || '',
      password: password || '',
      securityType: securityType || 'WPA',
      hidden: hidden || false,
    };

    // Upsert the setting
    await db
      .insert(settings)
      .values({
        key: WIFI_SETTINGS_KEY,
        value: config,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: config },
      });

    logActivity({
      userId: auth.userId,
      action: 'update',
      entityType: 'setting',
      summary: `Updated setting: WiFi config (${config.ssid})`,
    });

    return NextResponse.json({ success: true, config });
  } catch (error) {
    logError('Error saving WiFi config:', error);
    return NextResponse.json(
      { error: 'Failed to save WiFi config' },
      { status: 500 }
    );
  }
}
