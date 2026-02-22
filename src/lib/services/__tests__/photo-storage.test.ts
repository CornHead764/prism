/**
 * Tests for photo-storage service.
 *
 * Mocks sharp and fs to test path construction, resize logic,
 * thumbnail naming, and deletion behavior without actual I/O.
 */

import path from 'path';

// --- Mocks ---
const mockToFile = jest.fn().mockResolvedValue({ width: 1920, height: 1080, size: 500000 });
const mockResize = jest.fn().mockReturnValue({ toFile: mockToFile });
const mockRotate = jest.fn().mockReturnValue({
  metadata: jest.fn().mockResolvedValue({ width: 3000, height: 2000 }),
  resize: mockResize,
  toFile: mockToFile,
});

jest.mock('sharp', () => {
  const sharpFn = jest.fn().mockReturnValue({
    rotate: mockRotate,
  });
  return { __esModule: true, default: sharpFn };
});

const mockMkdir = jest.fn().mockResolvedValue(undefined);
const mockUnlink = jest.fn().mockResolvedValue(undefined);

jest.mock('fs', () => ({
  promises: {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
  },
}));

import { savePhoto, deletePhoto, getPhotoPath } from '../photo-storage';
import sharp from 'sharp';

describe('getPhotoPath', () => {
  it('returns originals path by default', () => {
    const result = getPhotoPath('photo.jpg');
    expect(result).toContain(path.join('originals', 'photo.jpg'));
  });

  it('returns thumbs path when thumb=true', () => {
    const result = getPhotoPath('photo.jpg', true);
    expect(result).toContain(path.join('thumbs', 'photo.jpg'));
  });

  it('uses data/photos base directory', () => {
    const result = getPhotoPath('test.png');
    expect(result).toContain(path.join('data', 'photos'));
  });

  it('handles filenames with special characters', () => {
    const result = getPhotoPath('my photo (1).jpg');
    expect(result).toContain('my photo (1).jpg');
  });
});

describe('savePhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRotate.mockReturnValue({
      metadata: jest.fn().mockResolvedValue({ width: 3000, height: 2000 }),
      resize: mockResize,
      toFile: mockToFile,
    });
    mockResize.mockReturnValue({ toFile: mockToFile });
    mockToFile.mockResolvedValue({ width: 1920, height: 1080, size: 500000 });
  });

  it('ensures directories exist before saving', async () => {
    await savePhoto(Buffer.from('fake-image'), 'photo.jpg');

    expect(mockMkdir).toHaveBeenCalledTimes(2);
    // Should create both originals and thumbs directories with recursive
    const mkdirCalls = mockMkdir.mock.calls;
    expect(mkdirCalls[0][1]).toEqual({ recursive: true });
    expect(mkdirCalls[1][1]).toEqual({ recursive: true });
  });

  it('auto-orients image via rotate()', async () => {
    await savePhoto(Buffer.from('fake-image'), 'photo.jpg');

    // sharp() is called, then rotate() is called on the result
    expect(sharp).toHaveBeenCalled();
    expect(mockRotate).toHaveBeenCalled();
  });

  it('resizes when image width exceeds MAX_WIDTH (1920)', async () => {
    mockRotate.mockReturnValue({
      metadata: jest.fn().mockResolvedValue({ width: 4000, height: 3000 }),
      resize: mockResize,
      toFile: mockToFile,
    });

    await savePhoto(Buffer.from('fake-image'), 'wide.jpg');

    // Should resize to 1920
    expect(mockResize).toHaveBeenCalledWith(1920, undefined, { withoutEnlargement: true });
  });

  it('does not resize when image width is under MAX_WIDTH', async () => {
    mockRotate.mockReturnValue({
      metadata: jest.fn().mockResolvedValue({ width: 1200, height: 800 }),
      resize: mockResize,
      toFile: mockToFile,
    });

    await savePhoto(Buffer.from('fake-image'), 'small.jpg');

    // resize should NOT be called on the original (only on thumbnail)
    // The original goes directly to toFile without resize
    // (The code checks metadata.width > MAX_WIDTH)
    // Since width=1200 < 1920, mockResize is NOT called for the original
    // But sharp() IS called for thumbnail, which also calls resize
    // Verify that the first resize (original) was NOT called
    expect(mockResize).not.toHaveBeenCalledWith(1920, undefined, { withoutEnlargement: true });
  });

  it('generates thumbnail with thumb_ prefix', async () => {
    await savePhoto(Buffer.from('fake-image'), 'photo.jpg');

    // The second sharp() call is for the thumbnail
    // Check that toFile was called with a path containing "thumb_photo.jpg"
    const toFileCalls = mockToFile.mock.calls;
    const thumbCall = toFileCalls.find((call: unknown[]) =>
      String(call[0]).includes('thumb_photo.jpg')
    );
    expect(thumbCall).toBeTruthy();
  });

  it('returns dimensions and thumbnail path', async () => {
    const result = await savePhoto(Buffer.from('fake-image'), 'result.jpg');

    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.sizeBytes).toBe(500000);
    expect(result.thumbnailPath).toBe('thumb_result.jpg');
  });
});

describe('deletePhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes original file', async () => {
    await deletePhoto('photo.jpg');

    expect(mockUnlink).toHaveBeenCalledTimes(1);
    const deletedPath = mockUnlink.mock.calls[0][0];
    expect(deletedPath).toContain(path.join('originals', 'photo.jpg'));
  });

  it('deletes thumbnail when provided', async () => {
    await deletePhoto('photo.jpg', 'thumb_photo.jpg');

    expect(mockUnlink).toHaveBeenCalledTimes(2);
    const paths = mockUnlink.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(paths.some(p => p.includes('originals'))).toBe(true);
    expect(paths.some(p => p.includes('thumbs'))).toBe(true);
  });

  it('does not attempt thumbnail deletion when not provided', async () => {
    await deletePhoto('photo.jpg');

    expect(mockUnlink).toHaveBeenCalledTimes(1);
  });

  it('does not attempt thumbnail deletion when null', async () => {
    await deletePhoto('photo.jpg', null);

    expect(mockUnlink).toHaveBeenCalledTimes(1);
  });

  it('does not throw when file does not exist', async () => {
    mockUnlink.mockRejectedValue(new Error('ENOENT'));

    // Should not throw
    await expect(deletePhoto('missing.jpg', 'thumb_missing.jpg')).resolves.toBeUndefined();
  });
});
