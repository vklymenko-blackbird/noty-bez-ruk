import { test, expect } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

test('first run shows the install step and three cards, then the library', async ({ page }) => {
  const watch = watchErrors(page);
  await openApp(page, { onboarded: false });
  await expect(page).toHaveURL(/#\/onboarding$/);

  await expect(page.getByTestId('onb-install-first')).toBeVisible();
  await page.getByTestId('onb-continue-safari').click();

  await expect(page.getByTestId('onb-next')).toBeVisible();
  await page.getByTestId('onb-next').click();
  await page.getByTestId('onb-next').click();

  await expect(page.getByTestId('onb-install')).toHaveCount(0);
  await expect(page.getByTestId('onb-start')).toBeVisible();
  await page.getByTestId('onb-start').click();
  await expect(page.getByTestId('screen-library')).toBeVisible();

  await page.reload();
  await page.waitForFunction(() => !!window.__notyTest);
  await expect(page.getByTestId('screen-library')).toBeVisible();
  await expect(page.getByTestId('screen-onboarding')).toHaveCount(0);

  watch.expectNoErrors();
});
