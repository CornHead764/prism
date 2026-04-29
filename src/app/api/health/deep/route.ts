import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireRole } from '@/lib/auth/requireAuth';
import { checkDatabaseConnection, db } from '@/lib/db/client';
import { getRedisClient } from '@/lib/cache/getRedisClient';
import { calendarSources, photoSources } from '@/lib/db/schema';
import { APP_VERSION } from '@/lib/constants';
import { isNotNull, lt } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const BACKUP_STALE_HOURS = 26; // alert if no backup in 26h (daily backups)
const OAUTH_WARN_DAYS = 7;     // warn if OAuth token expires within 7 days

interface CheckResult {
  status: 'ok' | 'warn' | 'error';
  detail?: string;
}

async function checkLastBackup(): Promise<CheckResult> {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return { status: 'warn', detail: 'Backup directory not found' };
    }
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.sql.gz') || f.endsWith('.sql'))
      .map((f) => ({
        name: f,
        mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    if (files.length === 0) {
      return { status: 'warn', detail: 'No backup files found' };
    }

    const latest = files[0]!;
    const ageMs = Date.now() - latest.mtime.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    if (ageHours > BACKUP_STALE_HOURS) {
      return {
        status: 'warn',
        detail: `Last backup ${Math.round(ageHours)}h ago (${latest.name})`,
      };
    }
    return { status: 'ok', detail: latest.name };
  } catch {
    return { status: 'error', detail: 'Failed to check backup directory' };
  }
}

async function checkOAuthTokens(): Promise<CheckResult> {
  try {
    const warnBefore = new Date(Date.now() + OAUTH_WARN_DAYS * 24 * 60 * 60 * 1000);

    const [expiredCalendar, expiredPhotos] = await Promise.all([
      db.select({ id: calendarSources.id })
        .from(calendarSources)
        .where(lt(calendarSources.tokenExpiresAt, warnBefore))
        .limit(1),
      db.select({ id: photoSources.id })
        .from(photoSources)
        .where(lt(photoSources.tokenExpiresAt, warnBefore))
        .limit(1),
    ]);

    const expiring = [
      expiredCalendar.length > 0 && 'calendar',
      expiredPhotos.length > 0 && 'photo',
    ].filter(Boolean);

    if (expiring.length > 0) {
      return { status: 'warn', detail: `OAuth tokens expiring soon: ${expiring.join(', ')}` };
    }
    return { status: 'ok' };
  } catch {
    return { status: 'error', detail: 'Failed to query OAuth token expiry' };
  }
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth, 'canModifySettings');
  if (roleCheck) return roleCheck;

  const [dbOk, redisOk, backupCheck, oauthCheck] = await Promise.all([
    checkDatabaseConnection().catch(() => false),
    getRedisClient().then((c) => c !== null).catch(() => false),
    checkLastBackup(),
    checkOAuthTokens(),
  ]);

  const overall =
    !dbOk || !redisOk || backupCheck.status === 'error' || oauthCheck.status === 'error'
      ? 'degraded'
      : backupCheck.status === 'warn' || oauthCheck.status === 'warn'
      ? 'warn'
      : 'ok';

  // Optional webhook notification on degradation
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (webhookUrl && overall !== 'ok') {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: overall, timestamp: new Date().toISOString() }),
      });
    } catch {
      // Non-critical — don't block the response
    }
  }

  return NextResponse.json(
    {
      status: overall,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      uptime: Math.floor(process.uptime()),
      checks: {
        database: dbOk ? 'ok' : 'error',
        redis: redisOk ? 'ok' : 'error',
        backup: backupCheck,
        oauth: oauthCheck,
      },
    },
    {
      status: overall === 'degraded' ? 503 : 200,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    },
  );
}
