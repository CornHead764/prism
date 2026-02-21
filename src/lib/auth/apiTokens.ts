import { createHash, randomBytes } from 'crypto';
import { db } from '@/lib/db/client';
import { apiTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { AuthResult } from './requireAuth';

/**
 * Generate a cryptographically random 64-char hex token.
 */
export function generateApiToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * SHA-256 hash a raw token for storage/lookup.
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Validate a raw bearer token against the DB.
 * Returns an AuthResult (parent role) on success, null on failure.
 * Updates lastUsedAt on successful validation.
 */
export async function validateApiToken(rawToken: string): Promise<AuthResult | null> {
  const hash = hashToken(rawToken);

  const [token] = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, hash))
    .limit(1);

  if (!token) return null;

  // Fire-and-forget lastUsedAt update (don't block the request)
  db.update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, token.id))
    .then(() => {})
    .catch(() => {});

  return {
    userId: token.createdBy,
    role: 'parent',
  };
}

/**
 * Create a new API token. Returns the raw token (only visible once)
 * and the DB record (with hashed token).
 */
export async function createApiToken(name: string, createdBy: string) {
  const rawToken = generateApiToken();
  const tokenHash = hashToken(rawToken);

  const [record] = await db
    .insert(apiTokens)
    .values({ name, tokenHash, createdBy })
    .returning();

  return {
    rawToken,
    token: record!,
  };
}

/**
 * Delete (revoke) an API token by ID.
 */
export async function revokeApiToken(tokenId: string): Promise<boolean> {
  const result = await db
    .delete(apiTokens)
    .where(eq(apiTokens.id, tokenId))
    .returning({ id: apiTokens.id });

  return result.length > 0;
}

/**
 * List all API tokens (without sensitive hash data).
 */
export async function listApiTokens() {
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      createdBy: apiTokens.createdBy,
      lastUsedAt: apiTokens.lastUsedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .orderBy(apiTokens.createdAt);
}
