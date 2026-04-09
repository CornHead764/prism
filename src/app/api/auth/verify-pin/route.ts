import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { createSession, isLoginLockedOut, recordFailedLogin, clearLoginAttempts } from '@/lib/auth/session';
import { setSettingsVerified } from '@/lib/auth/settingsAuth';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

const appUrl = process.env.APP_URL || process.env.BASE_URL;
const isSecure = appUrl ? appUrl.startsWith('https://') : process.env.NODE_ENV === 'production';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, pin } = body;

    if (!userId || !pin) {
      return NextResponse.json(
        { error: 'userId and pin are required' },
        { status: 400 }
      );
    }

    // Rate limiting
    const lockoutStatus = await isLoginLockedOut(userId);
    if (lockoutStatus.lockedOut) {
      return NextResponse.json(
        {
          error: 'Too many failed attempts. Please try again later.',
          lockedOut: true,
          retryAfter: lockoutStatus.retryAfter,
        },
        { status: 403 }
      );
    }

    // Verify user exists and is a parent
    const [user] = await db
      .select({ id: users.id, name: users.name, role: users.role, color: users.color, avatarUrl: users.avatarUrl, pin: users.pin })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role !== 'parent') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!user.pin) {
      return NextResponse.json({ error: 'No PIN set for this user' }, { status: 400 });
    }

    const isValidPin = await bcrypt.compare(pin, user.pin);

    if (!isValidPin) {
      const { remainingAttempts } = await recordFailedLogin(userId);
      return NextResponse.json(
        { error: 'Invalid PIN', remainingAttempts },
        { status: 401 }
      );
    }

    // Clear failed attempts on success
    await clearLoginAttempts(userId);

    const cookieStore = await cookies();
    let sessionToken = cookieStore.get('prism_session')?.value;

    // If no app session exists, create one so the login carries over
    if (!sessionToken) {
      const session = await createSession(user.id, user.role as 'parent', {
        userAgent: request.headers.get('user-agent') || undefined,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      });

      if (session) {
        sessionToken = session.token;

        cookieStore.set('prism_session', session.token, {
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          expires: session.expiresAt,
          path: '/',
        });

        cookieStore.set('prism_user', user.id, {
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          expires: session.expiresAt,
          path: '/',
        });

        logActivity({
          userId: user.id,
          action: 'login',
          entityType: 'session',
          summary: `Logged in via settings: ${user.name}`,
        });
      }
    }

    // Set Redis flag for settings verification
    if (sessionToken) {
      await setSettingsVerified(sessionToken);
    }

    return NextResponse.json({
      verified: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        color: user.color,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    logError('Error verifying PIN:', error);
    return NextResponse.json(
      { error: 'Failed to verify PIN' },
      { status: 500 }
    );
  }
}
