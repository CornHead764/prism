import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { getGmailAuthUrl } from '@/lib/integrations/gmail';
import { logError } from '@/lib/utils/logError';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const state = JSON.stringify({ returnSection: 'bus' });
    const authUrl = getGmailAuthUrl(state);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    logError('Failed to initiate Gmail OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Gmail authentication' },
      { status: 500 }
    );
  }
}
