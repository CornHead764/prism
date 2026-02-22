import { validateMagicBytes } from '../validateFileType';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

describe('validateMagicBytes', () => {
  describe('JPEG detection', () => {
    it('detects valid JPEG magic bytes', () => {
      const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      expect(validateMagicBytes(buf, ALLOWED_TYPES)).toBe('image/jpeg');
    });

    it('detects JPEG with different JFIF marker', () => {
      const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE1, 0x00]);
      expect(validateMagicBytes(buf, ALLOWED_TYPES)).toBe('image/jpeg');
    });
  });

  describe('PNG detection', () => {
    it('detects valid PNG magic bytes', () => {
      const buf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]);
      expect(validateMagicBytes(buf, ALLOWED_TYPES)).toBe('image/png');
    });
  });

  describe('GIF detection', () => {
    it('detects GIF87a', () => {
      const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
      expect(validateMagicBytes(buf, ALLOWED_TYPES)).toBe('image/gif');
    });

    it('detects GIF89a', () => {
      const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      expect(validateMagicBytes(buf, ALLOWED_TYPES)).toBe('image/gif');
    });
  });

  describe('WebP detection', () => {
    it('detects valid WebP (RIFF + WEBP)', () => {
      // RIFF....WEBP
      const buf = Buffer.alloc(12);
      buf.write('RIFF', 0);
      buf.writeUInt32LE(100, 4); // file size
      buf.write('WEBP', 8);
      expect(validateMagicBytes(buf, ALLOWED_TYPES)).toBe('image/webp');
    });

    it('rejects RIFF without WEBP marker', () => {
      const buf = Buffer.alloc(12);
      buf.write('RIFF', 0);
      buf.writeUInt32LE(100, 4);
      buf.write('AVI ', 8); // AVI, not WebP
      expect(validateMagicBytes(buf, ALLOWED_TYPES)).toBeNull();
    });
  });

  describe('rejection', () => {
    it('returns null for unknown format', () => {
      const buf = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(validateMagicBytes(buf, ALLOWED_TYPES)).toBeNull();
    });

    it('returns null for empty buffer', () => {
      expect(validateMagicBytes(Buffer.alloc(0), ALLOWED_TYPES)).toBeNull();
    });

    it('returns null for buffer too short for any signature', () => {
      const buf = Buffer.from([0xFF, 0xD8]); // JPEG needs 3 bytes
      expect(validateMagicBytes(buf, ALLOWED_TYPES)).toBeNull();
    });

    it('returns null when type is not in allowed list', () => {
      const jpegBuf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      expect(validateMagicBytes(jpegBuf, ['image/png'])).toBeNull();
    });

    it('returns null for text file disguised with wrong extension', () => {
      const buf = Buffer.from('This is just plain text content');
      expect(validateMagicBytes(buf, ALLOWED_TYPES)).toBeNull();
    });
  });
});
