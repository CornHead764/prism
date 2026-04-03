import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { listBackups, createBackup } from '@/lib/utils/backup';
import { rateLimitGuard } from '@/lib/cache/rateLimit';

/**
 * GET /api/admin/backups - List all backups
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const forbidden = requireRole(auth, 'canModifySettings');
    if (forbidden) return forbidden;

    const backups = await listBackups();
    return NextResponse.json({ backups });
  } catch (error) {
    console.error('Error listing backups:', error);
    return NextResponse.json(
      { error: 'Failed to list backups' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/backups - Create a new backup
 */
export async function POST() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const forbidden = requireRole(auth, 'canModifySettings');
    if (forbidden) return forbidden;

    const rateLimited = await rateLimitGuard(auth.userId, 'admin:backups', 5, 3600);
    if (rateLimited) return rateLimited;

    const result = await createBackup();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create backup' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      filename: result.filename,
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    return NextResponse.json(
      { error: 'Failed to create backup' },
      { status: 500 }
    );
  }
}
