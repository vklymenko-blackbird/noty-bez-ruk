import { test, expect } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

test.describe('settings screen @chromium', () => {
  test('gesture choice survives a reload', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { path: '/settings' });
    await expect(page.getByTestId('screen-settings')).toBeVisible();
    await page.getByTestId('set-gesture-mouth').click();
    await page.reload();
    await page.waitForFunction(() => !!window.__notyTest);
    await expect(page.getByTestId('set-gesture-mouth')).toHaveAttribute('aria-checked', 'true');
    watch.expectNoErrors();
  });

  test('dark theme sets data-theme on html', async ({ page }) => {
    await openApp(page, { path: '/settings' });
    await page.getByTestId('set-theme-dark').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('learn mode adds a pedal key as a chip', async ({ page }) => {
    await openApp(page, { path: '/settings' });
    await page.getByTestId('set-learn-next').click();
    await expect(page.getByTestId('set-learn-next')).toHaveText('Натисніть педаль…');
    await page.keyboard.press('a');
    await expect(page.getByTestId('set-keys-next-chip').filter({ hasText: /^A$/ })).toBeVisible();
  });

  test('privacy text is visible and the page has no horizontal scroll', async ({ page }) => {
    const watch = watchErrors(page);
    await page.setViewportSize({ width: 744, height: 1133 });
    await openApp(page, { path: '/settings' });
    await expect(page.getByText('Відео з камери обробляється лише на цьому iPad', { exact: false })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    watch.expectNoErrors();
  });
});
