import { db } from '@/lib/db/client';
import { auditLogs } from '@/lib/db/schema';
import { lt } from 'drizzle-orm';

/**
 * Deletes audit log entries older than 30 days.
 * Designed to be called piggyback-style on GET /api/audit-logs reads.
 * Fast with the createdAt index.
 */
export async function cleanupOldAuditLogs(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  try {
    await db.delete(auditLogs).where(lt(auditLogs.createdAt, thirtyDaysAgo));
  } catch (err) {
    console.error('Audit log cleanup failed:', err);
  }
}
