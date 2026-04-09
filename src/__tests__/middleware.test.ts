import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  path: string,
  {
    method = 'GET',
    headers = {},
  }: { method?: string; headers?: Record<string, string> } = {},
): NextRequest {
  const url = `http://localhost:3000${path}`;
  return new NextRequest(url, { method, headers: new Headers(headers) });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('middleware', () => {
  describe('x-request-id injection', () => {
    it('GET request — response includes x-request-id header', async () => {
      const req = makeRequest('/api/foo');
      const res = await middleware(req);

      const requestId = res.headers.get('x-request-id');
      expect(requestId).not.toBeNull();
      expect(requestId).toHaveLength(24);
    });

    it('POST with no x-request-id — response gets a generated 24-char hex id', async () => {
      const req = makeRequest('/api/foo', {
        method: 'POST',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      });
      const res = await middleware(req);

      const requestId = res.headers.get('x-request-id');
      expect(requestId).not.toBeNull();
      expect(requestId).toMatch(/^[0-9a-f]{24}$/);
    });

    it('POST with existing x-request-id — response propagates the same value', async () => {
      const req = makeRequest('/api/foo', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
          'x-request-id': 'existing-id',
        },
      });
      const res = await middleware(req);

      expect(res.headers.get('x-request-id')).toBe('existing-id');
    });
  });

  describe('CSRF protection', () => {
    it('POST with matching Origin/Host — passes through (200)', async () => {
      const req = makeRequest('/api/foo', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
        },
      });
      const res = await middleware(req);

      expect(res.status).not.toBe(403);
      expect(res.headers.get('x-request-id')).not.toBeNull();
    });

    it('POST with mismatched Origin — returns 403 with x-request-id', async () => {
      const req = makeRequest('/api/foo', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'http://evil.example.com',
        },
      });
      const res = await middleware(req);

      expect(res.status).toBe(403);
      expect(res.headers.get('x-request-id')).not.toBeNull();
    });

    it('POST with no Origin header — passes through (non-browser client)', async () => {
      const req = makeRequest('/api/foo', {
        method: 'POST',
        headers: { host: 'localhost:3000' },
      });
      const res = await middleware(req);

      expect(res.status).not.toBe(403);
      expect(res.headers.get('x-request-id')).not.toBeNull();
    });

    it('CSRF-exempt path /api/away-mode with cross-origin POST — passes through', async () => {
      const req = makeRequest('/api/away-mode', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'http://evil.example.com',
        },
      });
      const res = await middleware(req);

      expect(res.status).not.toBe(403);
      expect(res.headers.get('x-request-id')).not.toBeNull();
    });

    it('GET with mismatched Origin — passes through (CSRF only applies to mutations)', async () => {
      const req = makeRequest('/api/foo', {
        method: 'GET',
        headers: {
          host: 'localhost:3000',
          origin: 'http://evil.example.com',
        },
      });
      const res = await middleware(req);

      expect(res.status).not.toBe(403);
      expect(res.headers.get('x-request-id')).not.toBeNull();
    });
  });
});
