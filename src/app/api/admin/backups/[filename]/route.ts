import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { restoreBackup, deleteBackup, getBackupPath } from '@/lib/utils/backup';
import fs from 'fs/promises';
import { logError } from '@/lib/utils/logError';

interface RouteParams {
  params: Promise<{ filename: string }>;
}

/**
 * GET /api/admin/backups/[filename] - Download a backup file
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const forbidden = requireRole(auth, 'canModifySettings');
    if (forbidden) return forbidden;

    const { filename } = await params;
    const filePath = await getBackupPath(filename);

    if (!filePath) {
      return NextResponse.json(
        { error: 'Backup not found' },
        { status: 404 }
      );
    }

    const fileBuffer = await fs.readFile(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logError('Error downloading backup:', error);
    return NextResponse.json(
      { error: 'Failed to download backup' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/backups/[filename] - Restore from a backup
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const forbidden = requireRole(auth, 'canModifySettings');
    if (forbidden) return forbidden;

    const { filename } = await params;
    const result = await restoreBackup(filename);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to restore backup' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Error restoring backup:', error);
    return NextResponse.json(
      { error: 'Failed to restore backup' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/backups/[filename] - Delete a backup
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const forbidden = requireRole(auth, 'canModifySettings');
    if (forbidden) return forbidden;

    const { filename } = await params;
    const result = await deleteBackup(filename);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete backup' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Error deleting backup:', error);
    return NextResponse.json(
      { error: 'Failed to delete backup' },
      { status: 500 }
    );
  }
}
