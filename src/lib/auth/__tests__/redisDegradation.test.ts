/**
 * Tests for Redis-down graceful degradation in session validation and auth middleware.
 *
 * Covers:
 * - validateSession returning { ok: false, reason: 'unavailable' } when Redis is down
 * - requireAuth returning 503 (not 401) when session store is unreachable
 * - optionalAuth returning null (not 503) when session store is unreachable
 *
 * Two separate mock strategies are used:
 *   - validateSession tests: mock getRedisClient so the real validateSession runs
 *   - requireAuth/optionalAuth tests: mock validateSession directly (like requireAuth.test.ts)
 */

import { NextResponse } from 'next/server';

// --- Shared mock stores ---
let mockCookies: Record<string, string> = {};
let mockHeaders: Record<string, string> = {};

jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve({
    get: (name: string) => {
      const value = mockCookies[name];
      return value ? { value } : undefined;
    },
  }),
  headers: () => Promise.resolve({
    get: (name: string) => mockHeaders[name.toLowerCase()] ?? null,
  }),
}));

// Mock getRedisClient — controls Redis availability for validateSession tests
const mockGetRedisClient = jest.fn();
jest.mock('@/lib/cache/getRedisClient', () => ({
  getRedisClient: (...args: unknown[]) => mockGetRedisClient(...args),
}));

// Mock constants so session.ts can import them without issues
jest.mock('@/lib/constants', () => ({
  SESSION_DURATION: { PARENT: 86400, CHILD: 86400, GUEST: 3600 },
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 900,
}));

// Mock validateSession for requireAuth / optionalAuth tests.
// We use jest.mock with a factory that returns the real module with validateSession overridden.
// This allows us to spy/override in beforeEach via the mockValidateSession variable.
const mockValidateSession = jest.fn();
jest.mock('../session', () => {
  const actual = jest.requireActual('../session');
  return {
    ...actual,
    validateSession: (...args: unknown[]) => mockValidateSession(...args),
  };
});

const mockValidateApiToken = jest.fn();
jest.mock('../apiTokens', () => ({
  validateApiToken: (...args: unknown[]) => mockValidateApiToken(...args),
}));

// DB mock (used by getDisplayAuth in requireAuth module)
jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
  },
}));

jest.mock('@/lib/db/schema', () => ({
  settings: { key: 'key', value: 'value' },
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
}));

// Import real validateSession from session module.
// Because jest.mock('../session') overrides validateSession with mockValidateSession,
// we need to get the real implementation via jest.requireActual.
const { validateSession: realValidateSession } =
  jest.requireActual<typeof import('../session')>('../session');

import { requireAuth, optionalAuth } from '../requireAuth';

// ---------------------------------------------------------------------------
// validateSession — direct unit tests (real implementation, mocked Redis)
// ---------------------------------------------------------------------------

describe('validateSession — Redis-down degradation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns { ok: false, reason: "unavailable" } when getRedisClient returns null', async () => {
    mockGetRedisClient.mockResolvedValue(null);

    const result = await realValidateSession('any-token');

    expect(result).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('returns { ok: false, reason: "unavailable" } when Redis .get() throws', async () => {
    const fakeClient = {
      get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    };
    mockGetRedisClient.mockResolvedValue(fakeClient);

    const result = await realValidateSession('any-token');

    expect(result).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('returns { ok: false, reason: "invalid" } when Redis is up but session key is missing', async () => {
    const fakeClient = {
      get: jest.fn().mockResolvedValue(null), // key not found
    };
    mockGetRedisClient.mockResolvedValue(fakeClient);

    const result = await realValidateSession('nonexistent-token');

    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });
});

// ---------------------------------------------------------------------------
// requireAuth — Redis-down produces 503, not 401
// ---------------------------------------------------------------------------

describe('requireAuth — Redis-down degradation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookies = {};
    mockHeaders = {};
    mockValidateApiToken.mockResolvedValue(null);
  });

  it('returns 503 when validateSession reports unavailable', async () => {
    mockCookies['prism_session'] = 'some-token';
    mockValidateSession.mockResolvedValue({ ok: false, reason: 'unavailable' });

    const result = await requireAuth();

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(503);

    const body = await (result as NextResponse).json();
    expect(body.error).toContain('unavailable');
  });

  it('returns 401 (not 503) when validateSession reports invalid', async () => {
    mockCookies['prism_session'] = 'expired-token';
    mockValidateSession.mockResolvedValue({ ok: false, reason: 'invalid' });

    const result = await requireAuth();

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);

    const body = await (result as NextResponse).json();
    expect(body.error).not.toContain('unavailable');
  });
});

// ---------------------------------------------------------------------------
// optionalAuth — Redis-down produces null, not 503
// ---------------------------------------------------------------------------

describe('optionalAuth — Redis-down graceful degradation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookies = {};
    mockHeaders = {};
    mockValidateApiToken.mockResolvedValue(null);
  });

  it('returns null (not 503) when validateSession reports unavailable', async () => {
    mockCookies['prism_session'] = 'some-token';
    mockValidateSession.mockResolvedValue({ ok: false, reason: 'unavailable' });

    const result = await optionalAuth();

    expect(result).toBeNull();
  });

  it('returns null when validateSession reports invalid', async () => {
    mockCookies['prism_session'] = 'bad-token';
    mockValidateSession.mockResolvedValue({ ok: false, reason: 'invalid' });

    const result = await optionalAuth();

    expect(result).toBeNull();
  });
});
