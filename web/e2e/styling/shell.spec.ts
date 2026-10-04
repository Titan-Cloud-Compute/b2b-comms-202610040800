/**
 * Styling card — shell: every feature page renders inside the shared
 * LayoutComponent (sidebar + top bar) with Main / Vendor / Customer / Admin
 * nav groups, on desktop and on a 390px phone without sideways scrolling.
 */
import { test, expect, type Page } from '@playwright/test';
import { mockApi, login } from '../spec/_support';

test.use({ serviceWorkers: 'block' });

const PAGES: Array<{ path: string; testId: string }> = [
  { path: 'vendor/profile', testId: 'vendor-profile-screen' },
  { path: 'admin/customers', testId: 'admin-customers-screen' },
  { path: 'channels', testId: 'channels-screen' },
  { path: 'orders', testId: 'orders-screen' },
  { path: 'invoices', testId: 'invoices-screen' },
  { path: 'settings/notifications', testId: 'settings-notifications-screen' },
  { path: 'admin/audit-log', testId: 'admin-audit-log-screen' },
];

async function noSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const main = document.querySelector('main.main-content') as HTMLElement | null;
    const doc = document.documentElement;
    return {
      doc: doc.scrollWidth - doc.clientWidth,
      main: main ? main.scrollWidth - main.clientWidth : 0,
    };
  });
  expect(overflow.doc).toBeLessThanOrEqual(1);
  expect(overflow.main).toBeLessThanOrEqual(1);
}

test.describe('desktop shell', () => {
  for (const p of PAGES) {
    test(`${p.path} renders inside the layout`, async ({ page }) => {
      await mockApi(page);
      await login(page);
      await page.goto(`/#/${p.path}`);
      await expect(page.locator(`app-layout main.main-content [data-testid="${p.testId}"]`)).toBeVisible();
      await expect(page.locator('app-layout [data-testid="top-bar"]')).toBeVisible();
      await expect(page.locator('app-layout app-sidebar')).toBeAttached();
      await noSidewaysScroll(page);
    });
  }

  test('sidebar nav is grouped Main / Vendor / Customer / Admin', async ({ page }) => {
    await mockApi(page);
    await login(page);
    await page.goto('/#/orders');
    const labels = (await page.locator('.nav-group-label').allTextContents()).map(t => t.trim());
    for (const g of ['Main', 'Vendor', 'Customer', 'Admin']) expect(labels).toContain(g);
    expect(labels).not.toContain('Workspace');
    await expect(page.locator('.sidebar-nav a[href*="channels"]')).toHaveCount(1);
    await expect(page.locator('.sidebar-nav a[href*="audit-log"]')).toHaveCount(1);
  });
});

test.describe('390px phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const p of PAGES) {
    test(`${p.path} fits a 390px viewport`, async ({ page }) => {
      await mockApi(page);
      await login(page);
      await page.goto(`/#/${p.path}`);
      await expect(page.locator(`app-layout main.main-content [data-testid="${p.testId}"]`)).toBeVisible();
      await expect(page.locator('app-layout .mobile-header')).toBeVisible();
      await noSidewaysScroll(page);
    });
  }
});
