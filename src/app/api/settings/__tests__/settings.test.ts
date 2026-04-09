/**
 * Tests for GET and PATCH /api/settings
 *
 * Covers:
 * - GET: requires display auth, returns key-value map
 * - PATCH: requires parent auth, validates body, upserts setting, invalidates cache
 */

import { NextRequest, NextResponse } from 'next/server';

// --- DB mock ---
const mockSelect = jest.fn();
const mockFrom = jest.fn();
const mockWhere = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@/lib/db/client', () => ({
  db: {
    select: (...a: unknown[]) => mockSelect(...a),
    insert: (...a: unknown[]) => mockInsert(...a),
    update: (...a: unknown[]) => mockUpdate(...a),
  },
}));

jest.mock('@/lib/db/schema', () => ({
  settings: { key: 'key', value: 'value' },
  auditLogs: {},
}));

// --- Auth mock ---
const mockGetDisplayAuth = jest.fn();
const mockRequireAuth = jest.fn();
const mockRequireRole = jest.fn();

jest.mock('@/lib/auth', () => ({
  getDisplayAuth: () => mockGetDisplayAuth(),
  requireAuth: () => mockRequireAuth(),
  requireRole: (...a: unknown[]) => mockRequireRole(...a),
}));

// --- Cache mock ---
const mockInvalidateEntity = jest.fn();

jest.mock('@/lib/cache/cacheKeys', () => ({
  invalidateEntity: (...a: unknown[]) => mockInvalidateEntity(...a),
}));

// --- Other mocks ---
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('drizzle-orm', () => ({ eq: jest.fn() }));

import { GET, PATCH } from '../route';

const parentAuth = { userId: 'parent-1', role: 'parent' };

function makePatchRequest(body: object) {
  return new NextRequest('http://localhost:3000/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('GET /api/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDisplayAuth.mockResolvedValue(parentAuth);
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockResolvedValue([
      { key: 'theme', value: 'dark' },
      { key: 'language', value: 'en' },
    ]);
  });

  it('returns 401 when no display auth', async () => {
    mockGetDisplayAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns settings as key-value map', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings.theme).toBe('dark');
    expect(body.settings.language).toBe('en');
  });
});

describe('PATCH /api/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue(parentAuth);
    mockRequireRole.mockReturnValue(null);
    mockInvalidateEntity.mockResolvedValue(undefined);

    // Default: setting does not yet exist → insert path
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([]);

    mockInsert.mockReturnValue({
      values: jest.fn().mockReturnValue({
        onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
        returning: jest.fn().mockResolvedValue([{ key: 'theme', value: 'light' }]),
      }),
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    const res = await PATCH(makePatchRequest({ key: 'theme', value: 'light' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when non-parent tries to update settings', async () => {
    mockRequireRole.mockReturnValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
    const res = await PATCH(makePatchRequest({ key: 'theme', value: 'light' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 when key is missing', async () => {
    const res = await PATCH(makePatchRequest({ value: 'dark' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when value is missing', async () => {
    const res = await PATCH(makePatchRequest({ key: 'theme' }));
    expect(res.status).toBe(400);
  });

  it('upserts an existing setting successfully', async () => {
    // Existing setting → update path
    mockWhere.mockResolvedValue([{ key: 'theme', value: 'dark' }]);
    mockUpdate.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    });

    const res = await PATCH(makePatchRequest({ key: 'theme', value: 'light' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.value).toBe('light');
  });

  it('invalidates weather cache when location setting changes', async () => {
    mockWhere.mockResolvedValue([{ key: 'location', value: 'New York' }]);
    mockUpdate.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    });

    await PATCH(makePatchRequest({ key: 'location', value: 'London' }));
    expect(mockInvalidateEntity).toHaveBeenCalledWith('weather');
  });
});
