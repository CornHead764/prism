import { generateApiToken, hashToken } from '../apiTokens';

describe('generateApiToken', () => {
  it('returns a 64-char hex string', () => {
    const token = generateApiToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates unique tokens', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateApiToken());
    }
    expect(tokens.size).toBe(100);
  });
});

describe('hashToken', () => {
  it('returns a 64-char hex string (SHA-256)', () => {
    const hash = hashToken('test-token');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same input produces same hash', () => {
    const input = 'my-secret-token';
    expect(hashToken(input)).toBe(hashToken(input));
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = hashToken('token-a');
    const hash2 = hashToken('token-b');
    expect(hash1).not.toBe(hash2);
  });

  it('hash differs from the raw token', () => {
    const raw = generateApiToken();
    const hashed = hashToken(raw);
    expect(hashed).not.toBe(raw);
  });
});
