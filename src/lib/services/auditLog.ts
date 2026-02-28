import { db } from '@/lib/db/client';
import { auditLogs } from '@/lib/db/schema';

/**
 * Fire-and-forget audit log writer.
 * Never awaited — zero latency impact on API responses.
 */
export function logActivity(params: {
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}): void {
  db.insert(auditLogs)
    .values({
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      summary: params.summary,
      metadata: params.metadata ?? null,
    })
    .catch((err) => console.error('Audit log failed:', err));
}
