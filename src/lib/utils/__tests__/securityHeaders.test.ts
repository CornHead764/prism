// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildSecurityHeaders } = require('../securityHeaders');

describe('buildSecurityHeaders', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ALLOWED_FRAME_ANCESTORS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('default behavior (no env var)', () => {
    it('sets X-Frame-Options to SAMEORIGIN', () => {
      const headers = buildSecurityHeaders();
      const xfo = headers.find((h: { key: string; value: string }) => h.key === 'X-Frame-Options');
      expect(xfo).toBeDefined();
      expect(xfo!.value).toBe('SAMEORIGIN');
    });

    it('sets frame-ancestors to self only', () => {
      const headers = buildSecurityHeaders();
      const csp = headers.find((h: { key: string; value: string }) => h.key === 'Content-Security-Policy');
      expect(csp).toBeDefined();
      expect(csp!.value).toContain("frame-ancestors 'self'");
    });

    it('always includes X-Content-Type-Options', () => {
      const headers = buildSecurityHeaders();
      const header = headers.find((h: { key: string; value: string }) => h.key === 'X-Content-Type-Options');
      expect(header).toBeDefined();
      expect(header!.value).toBe('nosniff');
    });

    it('always includes Referrer-Policy', () => {
      const headers = buildSecurityHeaders();
      const header = headers.find((h: { key: string; value: string }) => h.key === 'Referrer-Policy');
      expect(header).toBeDefined();
      expect(header!.value).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('with ALLOWED_FRAME_ANCESTORS set', () => {
    it('allows a single origin', () => {
      process.env.ALLOWED_FRAME_ANCESTORS = 'http://homeassistant.local:8123';
      const headers = buildSecurityHeaders();
      const csp = headers.find((h: { key: string; value: string }) => h.key === 'Content-Security-Policy');
      expect(csp!.value).toContain("frame-ancestors 'self' http://homeassistant.local:8123");
    });

    it('allows multiple comma-separated origins', () => {
      process.env.ALLOWED_FRAME_ANCESTORS = 'http://ha.local:8123, https://my-ha.example.com';
      const headers = buildSecurityHeaders();
      const csp = headers.find((h: { key: string; value: string }) => h.key === 'Content-Security-Policy');
      expect(csp!.value).toContain("frame-ancestors 'self' http://ha.local:8123 https://my-ha.example.com");
    });

    it('removes X-Frame-Options when custom origins are set', () => {
      process.env.ALLOWED_FRAME_ANCESTORS = 'http://ha.local:8123';
      const headers = buildSecurityHeaders();
      const xfo = headers.find((h: { key: string; value: string }) => h.key === 'X-Frame-Options');
      expect(xfo).toBeUndefined();
    });

    it('trims whitespace from origins', () => {
      process.env.ALLOWED_FRAME_ANCESTORS = '  http://ha.local:8123  ,  https://other.com  ';
      const headers = buildSecurityHeaders();
      const csp = headers.find((h: { key: string; value: string }) => h.key === 'Content-Security-Policy');
      expect(csp!.value).toContain("frame-ancestors 'self' http://ha.local:8123 https://other.com");
    });

    it('ignores empty entries from extra commas', () => {
      process.env.ALLOWED_FRAME_ANCESTORS = 'http://ha.local:8123,,, ,';
      const headers = buildSecurityHeaders();
      const csp = headers.find((h: { key: string; value: string }) => h.key === 'Content-Security-Policy');
      expect(csp!.value).toBe("frame-ancestors 'self' http://ha.local:8123");
    });

    it('handles wildcard * for fully open embedding', () => {
      process.env.ALLOWED_FRAME_ANCESTORS = '*';
      const headers = buildSecurityHeaders();
      const csp = headers.find((h: { key: string; value: string }) => h.key === 'Content-Security-Policy');
      expect(csp!.value).toBe('frame-ancestors *');
      const xfo = headers.find((h: { key: string; value: string }) => h.key === 'X-Frame-Options');
      expect(xfo).toBeUndefined();
    });
  });

  describe('non-iframe headers are always present', () => {
    it('includes all standard security headers regardless of frame config', () => {
      process.env.ALLOWED_FRAME_ANCESTORS = 'http://ha.local:8123';
      const headers = buildSecurityHeaders();
      const keys = headers.map((h: { key: string; value: string }) => h.key);
      expect(keys).toContain('X-Content-Type-Options');
      expect(keys).toContain('Referrer-Policy');
      expect(keys).toContain('Content-Security-Policy');
    });
  });
});
