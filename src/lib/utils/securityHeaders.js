/**
 * Builds security headers for Next.js config.
 *
 * Iframe embedding is controlled via the ALLOWED_FRAME_ANCESTORS env var:
 *   - Not set:          Only same-origin embedding allowed (X-Frame-Options: SAMEORIGIN)
 *   - Comma-separated:  Specific origins allowed (e.g., "http://homeassistant.local:8123")
 *   - "*":              Any origin can embed (no X-Frame-Options, frame-ancestors *)
 *
 * Example for Home Assistant:
 *   ALLOWED_FRAME_ANCESTORS=http://homeassistant.local:8123
 */
function buildSecurityHeaders() {
  /** @type {{ key: string; value: string }[]} */
  const headers = [];

  const allowedAncestors = process.env.ALLOWED_FRAME_ANCESTORS?.trim();

  if (allowedAncestors === '*') {
    headers.push({ key: 'Content-Security-Policy', value: 'frame-ancestors *' });
  } else if (allowedAncestors) {
    const origins = allowedAncestors
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);
    headers.push({
      key: 'Content-Security-Policy',
      value: `frame-ancestors 'self' ${origins.join(' ')}`,
    });
  } else {
    headers.push({ key: 'X-Frame-Options', value: 'SAMEORIGIN' });
    headers.push({ key: 'Content-Security-Policy', value: "frame-ancestors 'self'" });
  }

  headers.push({ key: 'X-Content-Type-Options', value: 'nosniff' });
  headers.push({ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' });

  return headers;
}

module.exports = { buildSecurityHeaders };
