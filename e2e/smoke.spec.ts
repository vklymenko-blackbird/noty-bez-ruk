import { test, expect } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

test('app opens, library and settings show, fonts load @webkit', async ({ page }) => {
  const watch = watchErrors(page);
  await openApp(page);
  await expect(page.getByTestId('screen-library')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Мої ноти' })).toBeVisible();

  await page.evaluate(() => window.__notyTest!.navigate('/settings'));
  await expect(page.getByTestId('screen-settings')).toBeVisible();

  const loaded = await page.evaluate(async () => {
    await document.fonts.load('600 32px "Cormorant Garamond"', 'Ноти');
    await document.fonts.ready;
    return document.fonts.check('600 32px "Cormorant Garamond"', 'Ноти');
  });
  expect(loaded).toBe(true);
  watch.expectNoErrors();
});

test('dev harness routes render with the stubs', async ({ page }) => {
  const watch = watchErrors(page);
  await openApp(page, { path: '/dev/controls' });
  await expect(page.getByTestId('dev-controls')).toBeVisible();
  for (const what of ['gesture', 'pageview/none', 'annot/none']) {
    await page.evaluate((p) => window.__notyTest!.navigate(`/dev/${p}`), what);
    await expect(page.getByTestId(`dev-${what.split('/')[0]}`)).toBeVisible();
  }
  watch.expectNoErrors();
});
