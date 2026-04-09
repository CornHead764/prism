/**
 * Tests for GET /api/health/deep
 *
 * Covers:
 * - All healthy → status ok, HTTP 200
 * - OAuth expiring soon (calendar) → checks.oauth warn
 * - OAuth expiring soon (photos) → checks.oauth warn
 * - No backup directory → checks.backup warn
 * - Stale backup (> 26h) → checks.backup warn
 * - Redis down → checks.redis error, HTTP 503
 * - DB down → checks.database error, HTTP 503
 * - Unauthenticated request → 401
 * - Non-parent (missing canModifySettings) → 403
 */

import { NextResponse } from 'next/server';

// --- Auth mocks ---
const mockRequireAuth = jest.fn();
const mockRequireRole = jest.fn();

jest.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: () => mockRequireAuth(),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

// --- DB mock ---
// Chainable mock: select().from().where().limit() resolves to []
const mockLimit = jest.fn().mockResolvedValue([]);
const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit });
const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
const mockSelect = jest.fn().mockReturnValue({ from: mockFrom });

const mockCheckDatabaseConnection = jest.fn().mockResolvedValue(true);

jest.mock('@/lib/db/client', () => ({
  checkDatabaseConnection: (...a: unknown[]) => mockCheckDatabaseConnection(...a),
  db: {
    select: (...a: unknown[]) => mockSelect(...a),
    from: (...a: unknown[]) => mockFrom(...a),
    where: (...a: unknown[]) => mockWhere(...a),
    limit: (...a: unknown[]) => mockLimit(...a),
  },
}));

// --- Schema mock ---
jest.mock('@/lib/db/schema', () => ({
  calendarSources: { id: 'id', tokenExpiresAt: 'tokenExpiresAt' },
  photoSources: { id: 'id', tokenExpiresAt: 'tokenExpiresAt' },
}));

// --- drizzle-orm mock ---
jest.mock('drizzle-orm', () => ({
  isNotNull: jest.fn((col: unknown) => ({ type: 'isNotNull', col })),
  lt: jest.fn((col: unknown, val: unknown) => ({ type: 'lt', col, val })),
}));

// --- Redis mock ---
const mockRedisClient = { ping: jest.fn().mockResolvedValue('PONG') };
const mockGetRedisClient = jest.fn().mockResolvedValue(mockRedisClient);

jest.mock('@/lib/cache/getRedisClient', () => ({
  getRedisClient: (...a: unknown[]) => mockGetRedisClient(...a),
}));

// --- fs mock ---
const NOW = Date.now();
const FRESH_MTIME = new Date(NOW - 2 * 60 * 60 * 1000); // 2 hours ago

const mockExistsSync = jest.fn().mockReturnValue(true);
const mockReaddirSync = jest.fn().mockReturnValue(['prism_20260409_020000.sql.gz']);
const mockStatSync = jest.fn().mockReturnValue({ mtime: FRESH_MTIME });

jest.mock('fs', () => ({
  existsSync: (...a: unknown[]) => mockExistsSync(...a),
  readdirSync: (...a: unknown[]) => mockReaddirSync(...a),
  statSync: (...a: unknown[]) => mockStatSync(...a),
}));

// Import AFTER all mocks are set up
import { GET } from '../deep/route';

const parentAuth = { userId: 'parent-1', role: 'parent' as const };

describe('GET /api/health/deep', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated parent with permission
    mockRequireAuth.mockResolvedValue(parentAuth);
    mockRequireRole.mockReturnValue(null);

    // Default: DB ok
    mockCheckDatabaseConnection.mockResolvedValue(true);

    // Default: Redis ok
    mockGetRedisClient.mockResolvedValue(mockRedisClient);

    // Default: fresh backup
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['prism_20260409_020000.sql.gz']);
    mockStatSync.mockReturnValue({ mtime: FRESH_MTIME });

    // Default: no expiring OAuth tokens
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([]);
  });

  // --- Test 1: All healthy ---
  it('returns status ok with HTTP 200 when all checks pass', async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.checks.database).toBe('ok');
    expect(data.checks.redis).toBe('ok');
    expect(data.checks.backup.status).toBe('ok');
    expect(data.checks.oauth.status).toBe('ok');
  });

  // --- Test 2: OAuth expiring soon (calendar) ---
  it('returns oauth warn when a calendar token is expiring soon', async () => {
    // First call (calendarSources) returns a row; second (photoSources) returns none
    mockLimit
      .mockResolvedValueOnce([{ id: 'cal-1' }])
      .mockResolvedValueOnce([]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('warn');
    expect(data.checks.oauth.status).toBe('warn');
    expect(data.checks.oauth.detail).toContain('calendar');
  });

  // --- Test 3: OAuth expiring soon (photos) ---
  it('returns oauth warn when a photo source token is expiring soon', async () => {
    // First call (calendarSources) returns none; second (photoSources) returns a row
    mockLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'photo-1' }]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('warn');
    expect(data.checks.oauth.status).toBe('warn');
    expect(data.checks.oauth.detail).toContain('photo');
  });

  // --- Test 4: No backup directory ---
  it('returns backup warn when backup directory does not exist', async () => {
    mockExistsSync.mockReturnValue(false);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('warn');
    expect(data.checks.backup.status).toBe('warn');
    expect(data.checks.backup.detail).toMatch(/not found/i);
  });

  // --- Test 4b: No backup files in directory ---
  it('returns backup warn when no backup files are present', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]); // empty directory

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('warn');
    expect(data.checks.backup.status).toBe('warn');
    expect(data.checks.backup.detail).toMatch(/no backup files/i);
  });

  // --- Test 5: Stale backup (> 26h ago) ---
  it('returns backup warn when last backup is older than 26 hours', async () => {
    const staleDate = new Date(NOW - 30 * 60 * 60 * 1000); // 30 hours ago
    mockStatSync.mockReturnValue({ mtime: staleDate });
    mockReaddirSync.mockReturnValue(['prism_20260408_000000.sql.gz']);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('warn');
    expect(data.checks.backup.status).toBe('warn');
    expect(data.checks.backup.detail).toMatch(/30h ago/i);
  });

  // --- Test 6: Redis down ---
  it('returns redis error and HTTP 503 when Redis is unavailable', async () => {
    mockGetRedisClient.mockResolvedValue(null);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.checks.redis).toBe('error');
  });

  // --- Test 7: DB down ---
  it('returns database error and HTTP 503 when DB is unavailable', async () => {
    mockCheckDatabaseConnection.mockResolvedValue(false);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.checks.database).toBe('error');
  });

  // --- Test 8: Unauthenticated request ---
  it('returns 401 when the request is not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    );

    const res = await GET();

    expect(res.status).toBe(401);
  });

  // --- Test 9: Non-parent / insufficient permission ---
  it('returns 403 when the user lacks canModifySettings permission', async () => {
    mockRequireRole.mockReturnValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    );

    const res = await GET();

    expect(res.status).toBe(403);
  });
});
