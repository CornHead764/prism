import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isSettingsVerified } from '@/lib/auth/settingsAuth';
import { logError } from '@/lib/utils/logError';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('prism_session')?.value;

    if (!sessionToken) {
      return NextResponse.json({ verified: false });
    }

    const verified = await isSettingsVerified(sessionToken);
    return NextResponse.json({ verified });
  } catch (error) {
    logError('Error checking settings verification:', error);
    return NextResponse.json({ verified: false });
  }
}
