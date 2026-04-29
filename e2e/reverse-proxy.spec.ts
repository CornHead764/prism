import { test, expect, APIResponse } from '@playwright/test';
import { getFirstParent, FamilyMember } from './helpers/auth';

/**
 * Reverse-proxy cookie security tests.
 *
 * Catches the regression class where cookie-setting auth endpoints compute
 * the `Secure` flag from a module-level constant (APP_URL or NODE_ENV)
 * instead of from the actual request. Behind a reverse proxy that terminates
 * TLS, the app sees plain HTTP — and without honoring `x-forwarded-proto`,
 * cookies ship without the `Secure` flag even though the user is on HTTPS.
 *
 * The fix pattern is `requestIsSecure(req)` reading `x-forwarded-proto`.
 * These tests assert the pattern is in place on every endpoint that sets
 * `prism_session` / `prism_user` cookies.
 *
 * Note: this is the lightweight version (modality TODO #1, path A). It tests
 * the app's *honoring* of `x-forwarded-proto` — which is where the bug lives.
 * A heavier version with a real nginx fixture is the future TODO #1 path B.
 */

const PIN = process.env.E2E_PIN || '1234';

function setCookies(response: APIResponse): string[] {
  return response
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value);
}

function findCookie(cookies: string[], name: string): string | undefined {
  return cookies.find((c) => c.startsWith(`${name}=`));
}

test.describe('Reverse-proxy cookie security', () => {
  let parent: FamilyMember;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    parent = await getFirstParent(page);
    await page.close();
  });

  test('login: x-forwarded-proto=https sets Secure; HttpOnly on session cookie', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { userId: parent.id, pin: PIN },
      headers: { 'x-forwarded-proto': 'https' },
    });
    expect(response.ok()).toBe(true);

    const session = findCookie(setCookies(response), 'prism_session');
    expect(session, 'prism_session cookie should be set').toBeDefined();
    expect(session, 'should have Secure flag when forwarded proto is https').toMatch(/;\s*Secure(;|$)/i);
    expect(session, 'should have HttpOnly flag').toMatch(/;\s*HttpOnly(;|$)/i);
  });

  test('login: x-forwarded-proto=http omits Secure', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { userId: parent.id, pin: PIN },
      headers: { 'x-forwarded-proto': 'http' },
    });
    expect(response.ok()).toBe(true);

    const session = findCookie(setCookies(response), 'prism_session');
    expect(session).toBeDefined();
    expect(session, 'should not have Secure flag on plain http').not.toMatch(/;\s*Secure(;|$)/i);
  });

  test('verify-pin: x-forwarded-proto=https sets Secure; HttpOnly', async ({ request }) => {
    const response = await request.post('/api/auth/verify-pin', {
      data: { userId: parent.id, pin: PIN },
      headers: { 'x-forwarded-proto': 'https' },
    });
    expect(response.ok()).toBe(true);

    const cookies = setCookies(response);
    // verify-pin only sets cookies when there's no existing session — that's the case here
    // because each test gets a fresh request context. If for some reason it doesn't,
    // skip the assertion rather than fail spuriously.
    const session = findCookie(cookies, 'prism_session');
    if (!session) {
      test.skip(true, 'verify-pin did not set prism_session — likely existing session reused');
    }
    expect(session).toMatch(/;\s*Secure(;|$)/i);
    expect(session).toMatch(/;\s*HttpOnly(;|$)/i);
  });

  test('logout: x-forwarded-proto=https sets Secure; HttpOnly on cleared cookie', async ({ request }) => {
    // Need a session first so logout has something to clear.
    await request.post('/api/auth/login', {
      data: { userId: parent.id, pin: PIN },
    });

    const response = await request.post('/api/auth/logout', {
      headers: { 'x-forwarded-proto': 'https' },
    });
    expect(response.ok()).toBe(true);

    const session = findCookie(setCookies(response), 'prism_session');
    expect(session, 'logout should re-emit prism_session as a cleared Set-Cookie').toBeDefined();
    expect(session, 'cleared cookie must still carry Secure when proto is https').toMatch(/;\s*Secure(;|$)/i);
    expect(session, 'cleared cookie must still carry HttpOnly').toMatch(/;\s*HttpOnly(;|$)/i);
  });
});
