/**
 * Tests for the Immich shared-link client.
 *
 * Covers URL parsing, the public/password-protected login flows, the typed
 * error mapping for the various 401/404 cases, and asset download (with and
 * without password — the password path requires a login round trip first to
 * pick up the session cookie).
 */

import {
  parseImmichShareUrl,
  fetchSharedLink,
  downloadImmichAsset,
  ImmichPasswordRequiredError,
  ImmichInvalidPasswordError,
  ImmichShareNotFoundError,
} from '../immich';

afterEach(() => {
  jest.clearAllMocks();
});

function mockFetchOnce(impl: () => Partial<Response> | Promise<Partial<Response>>) {
  global.fetch = jest.fn().mockImplementationOnce(impl);
}

function mockFetchSequence(impls: Array<() => Partial<Response> | Promise<Partial<Response>>>) {
  const fn = jest.fn();
  for (const impl of impls) fn.mockImplementationOnce(impl);
  global.fetch = fn;
}

describe('parseImmichShareUrl', () => {
  it('extracts server and key from a typical share URL', () => {
    const result = parseImmichShareUrl('https://immich.example.com/share/abc123');
    expect(result).toEqual({ serverUrl: 'https://immich.example.com', shareKey: 'abc123' });
  });

  it('ignores trailing path segments after the key', () => {
    const result = parseImmichShareUrl('https://immich.example.com/share/abc123/photos');
    expect(result.shareKey).toBe('abc123');
  });

  it('preserves a subpath deployment in serverUrl', () => {
    const result = parseImmichShareUrl('https://example.com/photos/share/xyz');
    expect(result).toEqual({ serverUrl: 'https://example.com/photos', shareKey: 'xyz' });
  });

  it('throws on a URL with no /share/ segment', () => {
    expect(() => parseImmichShareUrl('https://immich.example.com/album/abc123')).toThrow(
      /must contain \/share\//,
    );
  });

  it('throws on an empty string', () => {
    expect(() => parseImmichShareUrl('')).toThrow(/required/);
  });

  it('throws on an unparseable URL', () => {
    expect(() => parseImmichShareUrl('not a url')).toThrow(/Invalid Immich share URL/);
  });
});

describe('fetchSharedLink (public)', () => {
  it('GETs /shared-links/me with the key and maps assets', async () => {
    mockFetchOnce(() => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () =>
        Promise.resolve({
          album: { id: 'album-1', albumName: 'Vacation' },
          allowDownload: true,
          password: null,
          assets: [
            {
              id: 'a1',
              originalFileName: 'IMG.jpg',
              originalMimeType: 'image/jpeg',
              type: 'IMAGE',
              fileCreatedAt: '2025-01-01T00:00:00.000Z',
              width: 4032,
              height: 3024,
              exifInfo: { latitude: 37.7749, longitude: -122.4194 },
            },
          ],
        }),
    }));

    const link = await fetchSharedLink({ serverUrl: 'https://immich.example.com', shareKey: 'k' });

    const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(fetchUrl).toBe('https://immich.example.com/api/shared-links/me?key=k');

    expect(link.albumId).toBe('album-1');
    expect(link.hasPassword).toBe(false);
    expect(link.assets).toHaveLength(1);
    expect(link.assets[0]).toMatchObject({
      id: 'a1',
      originalMimeType: 'image/jpeg',
      latitude: 37.7749,
      longitude: -122.4194,
    });
  });

  it('throws ImmichPasswordRequiredError on 401', async () => {
    mockFetchOnce(() => ({ ok: false, status: 401, headers: new Headers() }));
    await expect(
      fetchSharedLink({ serverUrl: 'https://x', shareKey: 'k' }),
    ).rejects.toBeInstanceOf(ImmichPasswordRequiredError);
  });

  it('throws ImmichShareNotFoundError on 404', async () => {
    mockFetchOnce(() => ({ ok: false, status: 404, headers: new Headers() }));
    await expect(
      fetchSharedLink({ serverUrl: 'https://x', shareKey: 'k' }),
    ).rejects.toBeInstanceOf(ImmichShareNotFoundError);
  });

  it('exposes hasPassword=false when password field is null', async () => {
    mockFetchOnce(() => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({ password: null, assets: [] }),
    }));
    const link = await fetchSharedLink({ serverUrl: 'https://x', shareKey: 'k' });
    expect(link.hasPassword).toBe(false);
  });

  it('exposes hasPassword=true when password field is non-null', async () => {
    mockFetchOnce(() => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({ password: 'bcrypt-hash', assets: [] }),
    }));
    const link = await fetchSharedLink({ serverUrl: 'https://x', shareKey: 'k' });
    expect(link.hasPassword).toBe(true);
  });
});

describe('fetchSharedLink (password-protected)', () => {
  it('POSTs to /shared-links/login with the password as JSON body', async () => {
    mockFetchOnce(() => ({
      ok: true,
      status: 201,
      headers: new Headers(),
      json: () => Promise.resolve({ password: 'hash', assets: [] }),
    }));

    await fetchSharedLink({ serverUrl: 'https://x', shareKey: 'k', password: 'pw' });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://x/api/shared-links/login?key=k');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ password: 'pw' });
  });

  it('throws ImmichInvalidPasswordError on 401 from login', async () => {
    mockFetchOnce(() => ({ ok: false, status: 401, headers: new Headers() }));
    await expect(
      fetchSharedLink({ serverUrl: 'https://x', shareKey: 'k', password: 'wrong' }),
    ).rejects.toBeInstanceOf(ImmichInvalidPasswordError);
  });

  it('throws ImmichShareNotFoundError on 404 from login', async () => {
    mockFetchOnce(() => ({ ok: false, status: 404, headers: new Headers() }));
    await expect(
      fetchSharedLink({ serverUrl: 'https://x', shareKey: 'gone', password: 'pw' }),
    ).rejects.toBeInstanceOf(ImmichShareNotFoundError);
  });
});

describe('downloadImmichAsset', () => {
  it('downloads the original via /assets/:id/original with the key', async () => {
    mockFetchOnce(() => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: () => Promise.resolve(new Uint8Array([0xff, 0xd8]).buffer),
    }));

    const result = await downloadImmichAsset(
      { serverUrl: 'https://x', shareKey: 'k' },
      'asset-1',
    );

    const url = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toBe('https://x/api/assets/asset-1/original?key=k');
    expect(result.contentType).toBe('image/jpeg');
    expect(result.buffer).toBeInstanceOf(Buffer);
  });

  it('downloads the thumbnail when thumb=true', async () => {
    mockFetchOnce(() => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/webp' }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
    }));

    await downloadImmichAsset(
      { serverUrl: 'https://x', shareKey: 'k' },
      'asset-1',
      { thumb: true },
    );

    const url = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toBe('https://x/api/assets/asset-1/thumbnail?key=k&size=preview');
  });

  it('logs in first when password is provided and forwards Set-Cookie', async () => {
    const loginHeaders = new Headers();
    loginHeaders.append('set-cookie', 'immich_auth=session-token; Path=/; HttpOnly');

    mockFetchSequence([
      () => ({
        ok: true,
        status: 201,
        headers: loginHeaders,
        json: () => Promise.resolve({ password: 'hash', assets: [] }),
      }),
      () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(2)),
      }),
    ]);

    await downloadImmichAsset(
      { serverUrl: 'https://x', shareKey: 'k', password: 'pw' },
      'asset-1',
    );

    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(2);
    const [, downloadInit] = (global.fetch as jest.Mock).mock.calls[1];
    expect(downloadInit.headers.Cookie).toContain('immich_auth=session-token');
  });

  it('throws on a non-OK download response', async () => {
    mockFetchOnce(() => ({ ok: false, status: 500, statusText: 'Internal Server Error' }));
    await expect(
      downloadImmichAsset({ serverUrl: 'https://x', shareKey: 'k' }, 'asset-1'),
    ).rejects.toThrow(/Failed to download Immich asset/);
  });
});
