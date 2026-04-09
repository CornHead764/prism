import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { auditLogs, users } from '@/lib/db/schema';
import { eq, desc, and, count, SQL } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { cleanupOldAuditLogs } from '@/lib/services/auditCleanup';
import { logError } from '@/lib/utils/logError';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const forbidden = requireRole(auth, 'canModifySettings');
    if (forbidden) return forbidden;

    // Piggyback cleanup on read
    cleanupOldAuditLogs();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const entityType = searchParams.get('entityType');
    const userId = searchParams.get('userId');
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (entityType) {
      conditions.push(eq(auditLogs.entityType, entityType));
    }
    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, [totalResult]] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          summary: auditLogs.summary,
          metadata: auditLogs.metadata,
          createdAt: auditLogs.createdAt,
          userId: auditLogs.userId,
          userName: users.name,
          userColor: users.color,
          userAvatarUrl: users.avatarUrl,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ value: count() })
        .from(auditLogs)
        .where(whereClause),
    ]);

    return NextResponse.json({
      logs,
      total: totalResult?.value ?? 0,
      page,
    });
  } catch (error) {
    logError('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
