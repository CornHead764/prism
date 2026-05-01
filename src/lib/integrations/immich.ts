/**
 * Immich shared-link client.
 *
 * Supports public shared links and password-protected shared links.
 * For password-protected links we POST to /api/shared-links/login (added in
 * Immich v2.6.0) and reuse the resulting session cookie for subsequent calls.
 *
 * No persistent state — each call performs a fresh login when a password is
 * provided. The proxy layer's local file cache absorbs the cost.
 */

export interface ImmichShareCredentials {
  serverUrl: string;
  shareKey: string;
  password?: string | null;
}

export interface ImmichAsset {
  id: string;
  originalFileName: string;
  originalMimeType: string;
  type: 'IMAGE' | 'VIDEO' | 'OTHER';
  fileCreatedAt: string;
  width: number | null;
  height: number | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ImmichSharedLink {
  albumId: string | null;
  albumName: string | null;
  allowDownload: boolean;
  hasPassword: boolean;
  assets: ImmichAsset[];
}

export class ImmichPasswordRequiredError extends Error {
  constructor() {
    super('Immich shared link requires a password');
    this.name = 'ImmichPasswordRequiredError';
  }
}

export class ImmichInvalidPasswordError extends Error {
  constructor() {
    super('Incorrect Immich shared link password');
    this.name = 'ImmichInvalidPasswordError';
  }
}

export class ImmichShareNotFoundError extends Error {
  constructor() {
    super('Immich shared link not found');
    this.name = 'ImmichShareNotFoundError';
  }
}

/**
 * Parse an Immich share URL into its server origin and share key.
 *
 * Accepts forms like:
 *   https://immich.example.com/share/abc123
 *   https://immich.example.com/share/abc123/whatever
 *   https://immich.example.com/proxy/share/abc123  (subpath deployments)
 */
export function parseImmichShareUrl(url: string): { serverUrl: string; shareKey: string } {
  const trimmed = (url ?? '').trim();
  if (!trimmed) throw new Error('Immich share URL is required');

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid Immich share URL');
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  const shareIdx = segments.lastIndexOf('share');
  const shareKey = shareIdx === -1 ? undefined : segments[shareIdx + 1];
  if (!shareKey) {
    throw new Error('Immich share URL must contain /share/<key>');
  }
  const basePath = segments.slice(0, shareIdx).join('/');
  const serverUrl = basePath
    ? `${parsed.origin}/${basePath}`
    : parsed.origin;

  return { serverUrl, shareKey };
}

interface RawSharedLinkResponse {
  album?: { id?: string; albumName?: string } | null;
  allowDownload?: boolean;
  password?: string | null;
  assets?: Array<{
    id: string;
    originalFileName: string;
    originalMimeType: string;
    type: 'IMAGE' | 'VIDEO' | 'OTHER';
    fileCreatedAt: string;
    width?: number | null;
    height?: number | null;
    exifInfo?: { latitude?: number | null; longitude?: number | null } | null;
  }>;
}

function mapSharedLink(raw: RawSharedLinkResponse): ImmichSharedLink {
  return {
    albumId: raw.album?.id ?? null,
    albumName: raw.album?.albumName ?? null,
    allowDownload: !!raw.allowDownload,
    hasPassword: raw.password != null,
    assets: (raw.assets ?? []).map((a) => ({
      id: a.id,
      originalFileName: a.originalFileName,
      originalMimeType: a.originalMimeType,
      type: a.type,
      fileCreatedAt: a.fileCreatedAt,
      width: a.width ?? null,
      height: a.height ?? null,
      latitude: a.exifInfo?.latitude ?? null,
      longitude: a.exifInfo?.longitude ?? null,
    })),
  };
}

function extractCookies(headers: Headers): string | null {
  const getSetCookie = (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  let cookies: string[] = [];
  if (typeof getSetCookie === 'function') {
    cookies = getSetCookie.call(headers);
  } else {
    const single = headers.get('set-cookie');
    if (single) {
      // Best-effort split on commas that precede a cookie name (avoids splitting
      // on commas inside Expires=... values).
      cookies = single.split(/,(?=\s*[A-Za-z0-9_-]+=)/);
    }
  }
  const pairs = cookies
    .map((c) => c.split(';')[0]?.trim())
    .filter((p): p is string => !!p);
  return pairs.length ? pairs.join('; ') : null;
}

async function loginShare(
  serverUrl: string,
  shareKey: string,
  password: string,
): Promise<{ link: ImmichSharedLink; cookie: string | null }> {
  const url = `${serverUrl}/api/shared-links/login?key=${encodeURIComponent(shareKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new ImmichInvalidPasswordError();
  }
  if (res.status === 404) {
    throw new ImmichShareNotFoundError();
  }
  if (!res.ok) {
    throw new Error(`Immich shared-link login failed: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as RawSharedLinkResponse;
  return { link: mapSharedLink(raw), cookie: extractCookies(res.headers) };
}

/**
 * Fetch shared link metadata + asset list. Throws typed errors when the share
 * requires a password, the password is wrong, or the share is missing.
 */
export async function fetchSharedLink(
  creds: ImmichShareCredentials,
): Promise<ImmichSharedLink> {
  if (creds.password) {
    const { link } = await loginShare(creds.serverUrl, creds.shareKey, creds.password);
    return link;
  }

  const url = `${creds.serverUrl}/api/shared-links/me?key=${encodeURIComponent(creds.shareKey)}`;
  const res = await fetch(url);

  if (res.status === 401 || res.status === 403) {
    throw new ImmichPasswordRequiredError();
  }
  if (res.status === 404) {
    throw new ImmichShareNotFoundError();
  }
  if (!res.ok) {
    throw new Error(`Immich shared-link fetch failed: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as RawSharedLinkResponse;
  return mapSharedLink(raw);
}

/**
 * Download an asset's binary via the shared link. Returns the raw buffer +
 * upstream Content-Type so the proxy can pass it through unchanged.
 */
export async function downloadImmichAsset(
  creds: ImmichShareCredentials,
  assetId: string,
  opts: { thumb?: boolean } = {},
): Promise<{ buffer: Uint8Array<ArrayBuffer>; contentType: string }> {
  const cookie = creds.password
    ? (await loginShare(creds.serverUrl, creds.shareKey, creds.password)).cookie
    : null;

  const path = opts.thumb
    ? `/api/assets/${assetId}/thumbnail?key=${encodeURIComponent(creds.shareKey)}&size=preview`
    : `/api/assets/${assetId}/original?key=${encodeURIComponent(creds.shareKey)}`;

  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`${creds.serverUrl}${path}`, { headers, redirect: 'follow' });
  if (!res.ok) {
    throw new Error(
      `Failed to download Immich asset ${assetId}: ${res.status} ${res.statusText}`,
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  return { buffer: Buffer.from(arrayBuffer), contentType };
}
