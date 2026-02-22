/**
 * Tests for avatar-storage service.
 *
 * Mocks sharp (image processing) and fs to test
 * save, delete, and path generation.
 */

const mockSharpInstance = {
  rotate: jest.fn().mockReturnThis(),
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toFile: jest.fn().mockResolvedValue(undefined),
};

jest.mock('sharp', () => jest.fn(() => mockSharpInstance));

const mockMkdir = jest.fn().mockResolvedValue(undefined);
const mockUnlink = jest.fn().mockResolvedValue(undefined);

jest.mock('fs', () => ({
  promises: {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
  },
}));

import { saveAvatar, deleteAvatar, getAvatarPath } from '../avatar-storage';
import path from 'path';

const AVATARS_DIR = path.join(process.cwd(), 'data', 'avatars');

describe('saveAvatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates avatars directory, processes image, and returns filename', async () => {
    const buffer = Buffer.from('fake-image-data');
    const result = await saveAvatar(buffer, 'user-123');

    expect(result).toBe('user-123.jpg');
    expect(mockMkdir).toHaveBeenCalledWith(AVATARS_DIR, { recursive: true });
  });

  it('applies auto-rotate, resize to 256x256 cover, and JPEG quality 85', async () => {
    const buffer = Buffer.from('fake-image');
    await saveAvatar(buffer, 'user-1');

    expect(mockSharpInstance.rotate).toHaveBeenCalled();
    expect(mockSharpInstance.resize).toHaveBeenCalledWith(256, 256, { fit: 'cover' });
    expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 85 });
    expect(mockSharpInstance.toFile).toHaveBeenCalledWith(
      path.join(AVATARS_DIR, 'user-1.jpg')
    );
  });

  it('writes to correct path based on userId', async () => {
    await saveAvatar(Buffer.from('data'), 'abc-def');

    expect(mockSharpInstance.toFile).toHaveBeenCalledWith(
      path.join(AVATARS_DIR, 'abc-def.jpg')
    );
  });
});

describe('deleteAvatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('unlinks the avatar file', async () => {
    await deleteAvatar('user-123');

    expect(mockUnlink).toHaveBeenCalledWith(
      path.join(AVATARS_DIR, 'user-123.jpg')
    );
  });

  it('does not throw when file does not exist', async () => {
    mockUnlink.mockRejectedValueOnce(new Error('ENOENT: no such file'));

    await expect(deleteAvatar('nonexistent')).resolves.toBeUndefined();
  });
});

describe('getAvatarPath', () => {
  it('returns correct path for userId', () => {
    const result = getAvatarPath('user-456');

    expect(result).toBe(path.join(AVATARS_DIR, 'user-456.jpg'));
  });
});
