import { encrypt, decrypt, isEncrypted } from '../crypto';

// Set a valid 32-byte hex key for tests
const TEST_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes
beforeAll(() => { process.env.ENCRYPTION_KEY = TEST_KEY; });
afterAll(() => { delete process.env.ENCRYPTION_KEY; });

describe('encrypt / decrypt', () => {
  it('roundtrips a simple string', () => {
    const plaintext = 'hello world';
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('roundtrips an empty string', () => {
    const encrypted = encrypt('');
    expect(decrypt(encrypted)).toBe('');
  });

  it('roundtrips unicode text', () => {
    const plaintext = 'Mj\u00f6lnir \u2603 \u{1F680}';
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('roundtrips a long string', () => {
    const plaintext = 'x'.repeat(10000);
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('roundtrips JSON', () => {
    const obj = { accessToken: 'abc123', refreshToken: 'def456' };
    const plaintext = JSON.stringify(obj);
    expect(JSON.parse(decrypt(encrypt(plaintext)))).toEqual(obj);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const plaintext = 'same input';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    // But both decrypt to the same thing
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it('ciphertext is valid base64', () => {
    const encrypted = encrypt('test');
    expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    // Re-encoding matches (proves it's clean base64)
    const buf = Buffer.from(encrypted, 'base64');
    expect(buf.toString('base64')).toBe(encrypted);
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = encrypt('secret');
    const buf = Buffer.from(encrypted, 'base64');
    // Flip a byte in the ciphertext portion (after IV + authTag)
    buf[28] = buf[28]! ^ 0xff;
    const tampered = buf.toString('base64');
    expect(() => decrypt(tampered)).toThrow();
  });
});

describe('isEncrypted', () => {
  it('returns true for an encrypted value', () => {
    const encrypted = encrypt('test');
    expect(isEncrypted(encrypted)).toBe(true);
  });

  it('returns false for short strings', () => {
    expect(isEncrypted('abc')).toBe(false);
    expect(isEncrypted('')).toBe(false);
  });

  it('returns false for plain text', () => {
    expect(isEncrypted('this is not encrypted at all')).toBe(false);
  });

  it('returns false for non-base64 strings', () => {
    expect(isEncrypted('!!!not-base64!!!')).toBe(false);
  });
});

describe('getKey validation', () => {
  it('throws when ENCRYPTION_KEY is missing', () => {
    const saved = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is required');
    process.env.ENCRYPTION_KEY = saved;
  });

  it('throws when ENCRYPTION_KEY is wrong length', () => {
    const saved = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'tooshort';
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be 64 hex characters');
    process.env.ENCRYPTION_KEY = saved;
  });
});
