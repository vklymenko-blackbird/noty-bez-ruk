import { expect, test } from '@playwright/test';
import { openApp, replayTrace, watchErrors } from './helpers';

test.describe('gesture UI on the dev harness', () => {
  test('calibration overlay, turns and HUD', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page, { path: '/dev/gesture' });
    await expect(page.getByTestId('calib-overlay')).toBeVisible();

    await replayTrace(page, 'turn-right-hold');
    await expect(page.getByTestId('dev-turns')).toHaveText('next');
    await expect(page.getByTestId('hud-dot')).toHaveCount(1);
    await page.waitForTimeout(1000);
    await expect(page.getByTestId('calib-overlay')).toHaveCount(0);

    await replayTrace(page, 'turn-left-hold');
    await expect(page.getByTestId('dev-turns')).toHaveText('next,prev');
    errors.expectNoErrors();
  });
});
