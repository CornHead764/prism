import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { createApiToken, listApiTokens } from '@/lib/auth/apiTokens';
import { createApiTokenSchema, validateRequest } from '@/lib/validations';

/**
 * GET /api/auth/tokens
 * List all API tokens (name, created date, last used — no hashes).
 * Parent-only.
 */
export async function GET() {
  return withAuth(async () => {
    try {
      const tokens = await listApiTokens();
      return NextResponse.json({ tokens });
    } catch (error) {
      console.error('Error listing API tokens:', error);
      return NextResponse.json(
        { error: 'Failed to list API tokens' },
        { status: 500 }
      );
    }
  }, { permission: 'canModifySettings' });
}

/**
 * POST /api/auth/tokens
 * Create a new API token. Returns the raw token once (never stored).
 * Parent-only.
 */
export async function POST(request: NextRequest) {
  return withAuth(async (auth) => {
    try {
      const body = await request.json();
      const validation = validateRequest(createApiTokenSchema, body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: validation.error.flatten() },
          { status: 400 }
        );
      }

      const { rawToken, token } = await createApiToken(
        validation.data.name,
        auth.userId
      );

      return NextResponse.json({
        token: rawToken,
        id: token.id,
        name: token.name,
        createdAt: token.createdAt.toISOString(),
      }, { status: 201 });
    } catch (error) {
      console.error('Error creating API token:', error);
      return NextResponse.json(
        { error: 'Failed to create API token' },
        { status: 500 }
      );
    }
  }, {
    permission: 'canModifySettings',
    rateLimit: { feature: 'api-tokens', limit: 10, windowSeconds: 60 },
  });
}
