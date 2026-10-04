/**
 * Styling card — auth pages: /login, /signup/1 and /dashboard show no
 * horizontal scroll at 1280x800 and 390x844 and use the --font-body family.
 */
import { test, expect, type Page } from '@playwright/test';
import { mockApi, login } from '../spec/_support';

test.use({ serviceWorkers: 'block' });

async function noSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function usesFontBody(page: Page): Promise<void> {
  const ok = await page.evaluate(() => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--font-body').trim();
    if (!raw) return false;
    const firstFamily = raw.split(',')[0].trim().replace(/['"]/g, '');
    const bodyFont = getComputedStyle(document.body).fontFamily;
    return bodyFont.replace(/['"]/g, '').startsWith(firstFamily);
  });
  expect(ok, '--font-body family should be used on body').toBe(true);
}

for (const { label, viewport } of [
  { label: 'desktop 1280×800', viewport: { width: 1280, height: 800 } },
  { label: 'mobile 390×844',   viewport: { width: 390,  height: 844 } },
]) {
  test.describe(label, () => {
    test.use({ viewport });

    test('login: no sideways scroll and uses --font-body', async ({ page }) => {
      await mockApi(page);
      await page.goto('/#/login');
      await page.waitForLoadState('networkidle');
      await noSidewaysScroll(page);
      await usesFontBody(page);
    });

    test('signup/1: no sideways scroll and uses --font-body', async ({ page }) => {
      await mockApi(page);
      await page.goto('/#/signup/1');
      await page.waitForLoadState('networkidle');
      await noSidewaysScroll(page);
      await usesFontBody(page);
    });

    test('dashboard: no sideways scroll and uses --font-body', async ({ page }) => {
      await mockApi(page);
      await login(page);
      await page.waitForLoadState('networkidle');
      await noSidewaysScroll(page);
      await usesFontBody(page);
    });
  });
}
