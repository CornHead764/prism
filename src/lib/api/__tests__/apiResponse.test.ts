import { apiError, apiSuccess, ApiErrorCode } from '../apiResponse';

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({ body, status: init?.status ?? 200 })),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NextResponse } = require('next/server') as {
  NextResponse: { json: jest.Mock };
};

describe('apiError', () => {
  beforeEach(() => {
    NextResponse.json.mockClear();
  });

  const cases: Array<[ApiErrorCode, number]> = [
    ['UNAUTHORIZED', 401],
    ['FORBIDDEN', 403],
    ['NOT_FOUND', 404],
    ['VALIDATION_ERROR', 400],
    ['INTERNAL_ERROR', 500],
    ['SERVICE_UNAVAILABLE', 503],
  ];

  test.each(cases)(
    '%s maps to default HTTP status %i',
    (code, expectedStatus) => {
      apiError(code, 'test message');
      expect(NextResponse.json).toHaveBeenCalledTimes(1);
      const [, init] = NextResponse.json.mock.calls[0];
      expect(init.status).toBe(expectedStatus);
    }
  );

  test.each(cases)(
    '%s response body has shape { error: { code, message } }',
    (code) => {
      const msg = `message for ${code}`;
      apiError(code, msg);
      const [body] = NextResponse.json.mock.calls[0];
      expect(body).toEqual({ error: { code, message: msg } });
    }
  );

  test('custom status override replaces the default', () => {
    apiError('NOT_FOUND', 'gone', 410);
    const [body, init] = NextResponse.json.mock.calls[0];
    expect(init.status).toBe(410);
    expect(body).toEqual({ error: { code: 'NOT_FOUND', message: 'gone' } });
  });

  test('custom status 0 is respected (edge case: falsy override)', () => {
    // status=0 is a weird value but the helper uses `?? STATUS_MAP[code]`,
    // so 0 (falsy) would fall through to the default.  Document the actual behaviour.
    apiError('INTERNAL_ERROR', 'oops', 0);
    const [, init] = NextResponse.json.mock.calls[0];
    // 0 is falsy — `0 ?? 500` → 0 (nullish coalescing only short-circuits on null/undefined)
    expect(init.status).toBe(0);
  });
});

describe('apiSuccess', () => {
  beforeEach(() => {
    NextResponse.json.mockClear();
  });

  test('returns 200 with data as-is when no status is provided', () => {
    const data = { id: 1, name: 'Alice' };
    apiSuccess(data);
    expect(NextResponse.json).toHaveBeenCalledTimes(1);
    const [body, init] = NextResponse.json.mock.calls[0];
    expect(body).toEqual(data);
    expect(init.status).toBe(200);
  });

  test('returns 201 when status 201 is provided', () => {
    const data = { created: true };
    apiSuccess(data, 201);
    const [body, init] = NextResponse.json.mock.calls[0];
    expect(body).toEqual(data);
    expect(init.status).toBe(201);
  });

  test('passes data through unchanged for primitive types', () => {
    apiSuccess(42);
    const [body] = NextResponse.json.mock.calls[0];
    expect(body).toBe(42);
  });

  test('passes data through unchanged for arrays', () => {
    const arr = [1, 2, 3];
    apiSuccess(arr);
    const [body] = NextResponse.json.mock.calls[0];
    expect(body).toEqual(arr);
  });

  test('passes data through unchanged for null', () => {
    apiSuccess(null);
    const [body] = NextResponse.json.mock.calls[0];
    expect(body).toBeNull();
  });
});
