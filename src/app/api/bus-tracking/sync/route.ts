import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { syncBusEmails } from '@/lib/services/bus-tracking-sync';
import { logError } from '@/lib/utils/logError';

export async function POST() {
  return withAuth(async () => {
    try {
      const result = await syncBusEmails();
      return NextResponse.json(result);
    } catch (error) {
      logError('Bus sync error:', error);
      return NextResponse.json(
        { error: 'Sync failed' },
        { status: 500 }
      );
    }
  }, {
    permission: 'canModifySettings',
    rateLimit: { feature: 'bus-sync', limit: 10, windowSeconds: 60 },
  });
}
