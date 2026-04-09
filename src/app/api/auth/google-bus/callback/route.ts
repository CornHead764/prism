import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { apiCredentials } from '@/lib/db/schema';
import { exchangeGmailCodeForTokens } from '@/lib/integrations/gmail';
import { encrypt } from '@/lib/utils/crypto';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      logError('Gmail OAuth error:', error);
      return NextResponse.redirect(`${BASE_URL}/settings?section=bus&error=gmail_auth_denied`);
    }

    if (!code) {
      return NextResponse.redirect(`${BASE_URL}/settings?section=bus&error=missing_code`);
    }

    const tokens = await exchangeGmailCodeForTokens(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Encrypt tokens before storing
    const credentials = {
      accessToken: encrypt(tokens.access_token),
      refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
    };

    // Upsert into apiCredentials table (service: 'gmail-bus')
    const existing = await db.query.apiCredentials.findFirst({
      where: (creds, { eq }) => eq(creds.service, 'gmail-bus'),
    });

    if (existing) {
      await db.update(apiCredentials).set({
        encryptedCredentials: JSON.stringify(credentials),
        expiresAt,
        updatedAt: new Date(),
      }).where(eq(apiCredentials.id, existing.id));
    } else {
      await db.insert(apiCredentials).values({
        service: 'gmail-bus',
        encryptedCredentials: JSON.stringify(credentials),
        expiresAt,
      });
    }

    logActivity({
      userId: auth.userId,
      action: 'create',
      entityType: 'integration',
      summary: 'Connected Gmail for bus tracking',
    });

    return NextResponse.redirect(`${BASE_URL}/settings?section=bus&success=gmail_connected`);
  } catch (error) {
    logError('Gmail OAuth callback error:', error);
    return NextResponse.redirect(`${BASE_URL}/settings?section=bus&error=gmail_auth_failed`);
  }
}
