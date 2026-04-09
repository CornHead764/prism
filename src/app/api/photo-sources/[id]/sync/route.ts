import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { syncOneDriveSource } from '@/lib/services/photo-sync';
import { logError } from '@/lib/utils/logError';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    await syncOneDriveSource(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Error syncing photo source:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
