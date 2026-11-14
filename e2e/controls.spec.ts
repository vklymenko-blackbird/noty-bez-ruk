import { test, expect } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

test.describe('controls sheet in the dev harness', () => {
  test('the sheet is visible and each control reports its callback', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { path: '/dev/controls' });

    await expect(page.getByTestId('dev-controls')).toBeVisible();
    await expect(page.getByTestId('controls-sheet')).toBeVisible();

    const last = page.getByTestId('dev-last');

    // The harness starts with half = true and crop = true, so the switches flip them.
    await page.getByTestId('ctl-half').click();
    await expect(last).toHaveText('half:false');

    await page.getByTestId('ctl-paper-sepia').click();
    await expect(last).toHaveText('paper:sepia');

    await page.getByTestId('ctl-crop').click();
    await expect(last).toHaveText('crop:false');

    await page.getByTestId('ctl-flip').click();
    await expect(last).toHaveText('flip:true');

    await page.getByTestId('ctl-annotate').click();
    await expect(last).toHaveText('annotate:');

    await page.getByTestId('ctl-exit').click();
    await expect(last).toHaveText('exit:');

    watch.expectNoErrors();
  });
});
