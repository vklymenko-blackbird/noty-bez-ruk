import { test, expect } from '@playwright/test';

test('an old browser without WebAssembly sees the update message', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'WebAssembly', { value: undefined, configurable: true });
  });
  await page.goto('./?test=1#/');
  await expect(page.getByTestId('boot-unsupported')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Потрібне оновлення iPadOS' })).toBeVisible();
  await expect(page.getByTestId('screen-library')).toHaveCount(0);
});
