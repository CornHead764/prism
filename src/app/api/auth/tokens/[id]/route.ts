import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { revokeApiToken } from '@/lib/auth/apiTokens';
import { logError } from '@/lib/utils/logError';

/**
 * DELETE /api/auth/tokens/[id]
 * Revoke (delete) an API token by ID.
 * Parent-only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    try {
      const { id } = await params;
      const deleted = await revokeApiToken(id);

      if (!deleted) {
        return NextResponse.json(
          { error: 'Token not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      logError('Error revoking API token:', error);
      return NextResponse.json(
        { error: 'Failed to revoke API token' },
        { status: 500 }
      );
    }
  }, { permission: 'canModifySettings' });
}
