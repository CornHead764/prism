import { Page, expect } from '@playwright/test';

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  /**
   * Present on the unauthenticated `/api/family` response. Used as a fallback
   * for `loginViaAPI` when the caller has no session yet — the public response
   * intentionally redacts real UUIDs (id is '') and exposes loginIndex instead.
   */
  loginIndex?: number;
}

/**
 * Get all family members from the API.
 */
export async function getFamilyMembers(page: Page): Promise<FamilyMember[]> {
  const response = await page.request.get('/api/family');
  const data = await response.json();
  return Array.isArray(data) ? data : data.members;
}

/**
 * Find a family member by name.
 */
async function findMember(page: Page, name: string): Promise<FamilyMember> {
  const members = await getFamilyMembers(page);
  const member = members.find((m: FamilyMember) => m.name === name);
  if (!member) throw new Error(`Member "${name}" not found in: ${members.map(m => m.name).join(', ')}`);
  return member;
}

/**
 * Get the first parent member.
 */
export async function getFirstParent(page: Page): Promise<FamilyMember> {
  const members = await getFamilyMembers(page);
  const parent = members.find((m: FamilyMember) => m.role === 'parent');
  if (!parent) throw new Error('No parent found');
  return parent;
}

/**
 * Get the first child member.
 */
export async function getFirstChild(page: Page): Promise<FamilyMember> {
  const members = await getFamilyMembers(page);
  const child = members.find((m: FamilyMember) => m.role === 'child');
  if (!child) throw new Error('No child found');
  return child;
}

/** Default PIN — override via E2E_PIN environment variable. */
const DEFAULT_PIN = process.env.E2E_PIN || '1234';

/** Locator for the QuickPinModal overlay (rendered via portal at z-10001). */
const MODAL_SELECTOR = '.z-\\[10001\\]';

/**
 * Login via the UI — clicks "Log in", selects member, enters PIN digit by digit.
 */
export async function loginViaUI(page: Page, name: string, pin = DEFAULT_PIN) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Click the "Log in" button in the nav
  await page.click('button[aria-label="Log in"]');

  // QuickPinModal opens (title is "Login" when triggered from nav)
  const modal = page.locator(MODAL_SELECTOR);
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Select the member — scoped to the modal to avoid matching other buttons
  const memberBtn = modal.locator(`button:has-text("${name}")`);
  await memberBtn.click();

  // Type PIN digit by digit using keyboard
  for (const digit of pin) {
    await page.keyboard.press(digit);
    await page.waitForTimeout(150);
  }

  // Wait for modal to close and auth state to settle
  await page.waitForTimeout(1500);
}

/**
 * Login via API — fast, sets cookies directly without showing PIN pad.
 */
export async function loginViaAPI(page: Page, name: string, pin = DEFAULT_PIN) {
  const member = await findMember(page, name);

  // The public /api/family response redacts real UUIDs and returns loginIndex
  // instead — fall back to memberIndex when we don't have a real id.
  const data: Record<string, unknown> = { pin };
  if (member.id) data.userId = member.id;
  else if (typeof member.loginIndex === 'number') data.memberIndex = member.loginIndex;
  else throw new Error(`Member "${name}" has neither id nor loginIndex`);

  const response = await page.request.post('/api/auth/login', { data });

  if (!response.ok()) {
    throw new Error(`Login failed for ${name}: ${response.status()}`);
  }

  return member;
}

/**
 * Logout via API — clears session cookies.
 */
export async function logout(page: Page) {
  await page.request.post('/api/auth/logout');
}
