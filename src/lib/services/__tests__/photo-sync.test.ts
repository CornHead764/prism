/**
 * Tests for OneDrive photo sync service.
 *
 * Mocks DB, OneDrive integration, photo-storage, and crypto
 * to test the syncOneDriveSource workflow.
 */

// --- DB mock ---
const mockFindFirst = jest.fn();
const mockSelectFrom = jest.fn();
const mockInsertValues = jest.fn().mockResolvedValue(undefined);
const mockDeleteWhere = jest.fn().mockResolvedValue(undefined);
const mockUpdateSetWhere = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/db/client', () => ({
  db: {
    query: {
      photoSources: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    select: () => ({ from: () => ({ where: (...args: unknown[]) => mockSelectFrom(...args) }) }),
    insert: () => ({ values: (...args: unknown[]) => mockInsertValues(...args) }),
    delete: () => ({ where: (...args: unknown[]) => mockDeleteWhere(...args) }),
    update: () => ({ set: () => ({ where: (...args: unknown[]) => mockUpdateSetWhere(...args) }) }),
  },
}));

jest.mock('@/lib/db/schema', () => ({
  photos: { id: 'id', sourceId: 'sourceId', filename: 'filename', externalId: 'externalId' },
  photoSources: { id: 'id', type: 'type' },
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
}));

// --- OneDrive mock ---
const mockListPhotos = jest.fn();
const mockDownloadPhoto = jest.fn();
const mockRefreshAccessToken = jest.fn();

jest.mock('@/lib/integrations/onedrive', () => ({
  listPhotosInFolder: (...args: unknown[]) => mockListPhotos(...args),
  downloadPhoto: (...args: unknown[]) => mockDownloadPhoto(...args),
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
}));

// --- Photo storage mock ---
const mockSavePhoto = jest.fn();
const mockDeletePhoto = jest.fn();

jest.mock('../photo-storage', () => ({
  savePhoto: (...args: unknown[]) => mockSavePhoto(...args),
  deletePhoto: (...args: unknown[]) => mockDeletePhoto(...args),
}));

// --- Crypto mock ---
jest.mock('@/lib/utils/crypto', () => ({
  decrypt: jest.fn((val: string) => `decrypted-${val}`),
  encrypt: jest.fn((val: string) => `encrypted-${val}`),
}));

import { syncOneDriveSource } from '../photo-sync';

const validSource = {
  id: 'source-1',
  type: 'onedrive',
  onedriveFolderId: 'folder-123',
  accessToken: 'enc-access',
  refreshToken: 'enc-refresh',
  tokenExpiresAt: new Date(Date.now() + 3600000), // 1 hour from now
};

describe('syncOneDriveSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindFirst.mockResolvedValue(validSource);
    mockSelectFrom.mockResolvedValue([]);
    mockListPhotos.mockResolvedValue([]);
  });

  it('throws when source does not exist', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(syncOneDriveSource('bad-id')).rejects.toThrow('Invalid OneDrive photo source');
  });

  it('throws when source type is not onedrive', async () => {
    mockFindFirst.mockResolvedValue({ ...validSource, type: 'google' });

    await expect(syncOneDriveSource('source-1')).rejects.toThrow('Invalid OneDrive photo source');
  });

  it('throws when source has no folderId', async () => {
    mockFindFirst.mockResolvedValue({ ...validSource, onedriveFolderId: null });

    await expect(syncOneDriveSource('source-1')).rejects.toThrow('Invalid OneDrive photo source');
  });

  it('throws when source has no OAuth tokens', async () => {
    mockFindFirst.mockResolvedValue({ ...validSource, accessToken: null, refreshToken: null });

    await expect(syncOneDriveSource('source-1')).rejects.toThrow('missing OAuth tokens');
  });

  it('downloads new photos not in the database', async () => {
    mockListPhotos.mockResolvedValue([
      { id: 'remote-1', name: 'photo1.jpg', file: { mimeType: 'image/jpeg' }, photo: { takenDateTime: '2026-01-15T10:00:00Z' } },
    ]);
    mockSelectFrom.mockResolvedValue([]); // no existing photos
    mockDownloadPhoto.mockResolvedValue(Buffer.from('image-data'));
    mockSavePhoto.mockResolvedValue({ width: 1920, height: 1080, sizeBytes: 5000, thumbnailPath: 'thumb_abc.jpg' });

    await syncOneDriveSource('source-1');

    expect(mockDownloadPhoto).toHaveBeenCalledWith('decrypted-enc-access', 'remote-1');
    expect(mockSavePhoto).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
  });

  it('skips photos already in the database', async () => {
    mockListPhotos.mockResolvedValue([
      { id: 'remote-1', name: 'photo1.jpg', file: { mimeType: 'image/jpeg' } },
    ]);
    mockSelectFrom.mockResolvedValue([
      { id: 'db-1', externalId: 'remote-1', filename: 'existing.jpg', thumbnailPath: null },
    ]);

    await syncOneDriveSource('source-1');

    expect(mockDownloadPhoto).not.toHaveBeenCalled();
    expect(mockSavePhoto).not.toHaveBeenCalled();
  });

  it('deletes local photos removed from remote', async () => {
    mockListPhotos.mockResolvedValue([]); // empty remote
    mockSelectFrom.mockResolvedValue([
      { id: 'db-1', externalId: 'remote-gone', filename: 'old.jpg', thumbnailPath: 'thumb_old.jpg' },
    ]);

    await syncOneDriveSource('source-1');

    expect(mockDeletePhoto).toHaveBeenCalledWith('old.jpg', 'thumb_old.jpg');
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it('refreshes token when expired', async () => {
    mockFindFirst.mockResolvedValue({
      ...validSource,
      tokenExpiresAt: new Date(Date.now() - 1000), // expired
    });
    mockRefreshAccessToken.mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    });
    mockListPhotos.mockResolvedValue([]);

    await syncOneDriveSource('source-1');

    expect(mockRefreshAccessToken).toHaveBeenCalledWith('decrypted-enc-refresh');
    expect(mockUpdateSetWhere).toHaveBeenCalled(); // token update
    expect(mockListPhotos).toHaveBeenCalledWith('new-access', 'folder-123');
  });

  it('continues syncing other photos when one download fails', async () => {
    mockListPhotos.mockResolvedValue([
      { id: 'r-1', name: 'fail.jpg', file: { mimeType: 'image/jpeg' } },
      { id: 'r-2', name: 'ok.jpg', file: { mimeType: 'image/jpeg' } },
    ]);
    mockSelectFrom.mockResolvedValue([]);
    mockDownloadPhoto
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(Buffer.from('ok'));
    mockSavePhoto.mockResolvedValue({ width: 800, height: 600, sizeBytes: 2000, thumbnailPath: null });

    await syncOneDriveSource('source-1');

    // First photo failed, second succeeded
    expect(mockDownloadPhoto).toHaveBeenCalledTimes(2);
    expect(mockSavePhoto).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
  });

  it('updates lastSynced timestamp after sync', async () => {
    await syncOneDriveSource('source-1');

    // Last call to update...set...where is the lastSynced update
    expect(mockUpdateSetWhere).toHaveBeenCalled();
  });
});
