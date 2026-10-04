/**
 * Styling card — pages: every feature page uses the shared token-only
 * primitives from styles.css (.page, .page-header, .card, …).
 */
import { test, expect } from '@playwright/test';
import { mockApi, login } from '../spec/_support';

test.use({ serviceWorkers: 'block' });

const PAGES: Array<{ path: string; testId: string; minCards: number }> = [
  { path: 'vendor/profile', testId: 'vendor-profile-screen', minCards: 2 },
  { path: 'admin/customers', testId: 'admin-customers-screen', minCards: 2 },
  { path: 'channels', testId: 'channels-screen', minCards: 2 },
  { path: 'orders', testId: 'orders-screen', minCards: 3 },
  { path: 'invoices', testId: 'invoices-screen', minCards: 2 },
  { path: 'settings/notifications', testId: 'settings-notifications-screen', minCards: 1 },
  { path: 'admin/audit-log', testId: 'admin-audit-log-screen', minCards: 2 },
];

for (const p of PAGES) {
  test(`${p.path} uses the shared page primitives`, async ({ page }) => {
    await mockApi(page);
    await login(page);
    await page.goto(`/#/${p.path}`);
    const root = page.getByTestId(p.testId);
    await expect(root).toBeVisible();
    await expect(root).toHaveClass(/\bpage\b/);
    await expect(root.locator('.page-header h1')).toBeVisible();
    expect(await root.locator('.card').count()).toBeGreaterThanOrEqual(p.minCards);

    // Cards resolve their surface from tokens (not the UA default transparent).
    const bg = await root.locator('.card').first().evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  });
}

test('orders submit button is a primary button', async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.goto('/#/orders');
  await expect(page.locator('[data-testid="create-order-form"] button[type="submit"]')).toHaveClass(/\bbtn-primary\b/);
});

test('audit log table uses the shared data-table in a scroll wrapper', async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.goto('/#/admin/audit-log');
  await expect(page.getByTestId('audit-log-table')).toHaveClass(/\bdata-table\b/);
  await expect(page.locator('.table-scroll [data-testid="audit-log-table"]')).toBeAttached();
});
