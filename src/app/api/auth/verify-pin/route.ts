import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { isLoginLockedOut, recordFailedLogin, clearLoginAttempts } from '@/lib/auth/session';
import { setSettingsVerified } from '@/lib/auth/settingsAuth';

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
      .select({ id: users.id, role: users.role, pin: users.pin })
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

    // Set Redis flag for settings verification
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('prism_session')?.value;
    if (sessionToken) {
      await setSettingsVerified(sessionToken);
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return NextResponse.json(
      { error: 'Failed to verify PIN' },
      { status: 500 }
    );
  }
}
