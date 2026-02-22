import { test, expect } from '@playwright/test';
import { loginViaAPI, logout, getFirstParent, FamilyMember } from './helpers/auth';
import { resetAll } from './helpers/reset';

test.describe('Dashboard', () => {
  let parent: FamilyMember;

  test.beforeAll(async ({ browser }) => {
    resetAll();
    const page = await browser.newPage();
    parent = await getFirstParent(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, parent.name);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('dashboard renders widgets after login', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The main content area should be present
    await expect(page.locator('main').first()).toBeVisible();

    // react-grid-layout renders items with class "react-grid-item"
    const widgets = page.locator('.react-grid-item');
    await expect(widgets.first()).toBeVisible({ timeout: 10000 });
    expect(await widgets.count()).toBeGreaterThan(0);
  });

  test('sidebar nav links navigate to correct pages', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click Calendar nav link
    await page.click('a[href="/calendar"]');
    await expect(page).toHaveURL(/\/calendar/);

    // Click Tasks nav link
    await page.click('a[href="/tasks"]');
    await expect(page).toHaveURL(/\/tasks/);

    // Click Shopping nav link
    await page.click('a[href="/shopping"]');
    await expect(page).toHaveURL(/\/shopping/);
  });

  test('direct URL routing works for feature pages', async ({ page }) => {
    await page.goto('/chores');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/chores/);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('dashboard home link returns to dashboard', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForLoadState('networkidle');

    // Click the logo/home link
    await page.click('a[href="/"]');
    await expect(page).toHaveURL(/\/$/);
  });
});
