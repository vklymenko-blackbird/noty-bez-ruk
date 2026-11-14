import { test, expect } from '@playwright/test';
import { MEDIAPIPE_LOG_IGNORE, addFixtureScore, getState, openApp, watchErrors } from './helpers';

// Chromium only: no @webkit tag.
test.describe('graceful failure', () => {
  test.setTimeout(60_000);

  test('a missing face model shows the banner and keys still turn pages', async ({ page }) => {
    // The blocked model request is an expected network error, so it is the only thing ignored here.
    const watch = watchErrors(page, { ignore: [...MEDIAPIPE_LOG_IGNORE, /face_landmarker\.task/, /Failed to load resource/, /net::ERR/] });
    await page.route('**/face_landmarker.task', (route) => route.abort());
    await openApp(page, { query: 'camera=1', settings: { halfPage: false } });
    const id = await addFixtureScore(page, 'score-3.pdf', 'Тест без моделі', 3);
    await page.evaluate((i) => window.__notyTest!.navigate(`/play/${i}`), id);
    await expect(page.getByTestId('play-root')).toBeVisible();

    const banner = page.getByTestId('play-camera-banner');
    await expect(banner).toBeVisible({ timeout: 45_000 });
    await expect(banner).toContainText('Розпізнавання обличчя не завантажилося');

    await page.keyboard.press('PageDown');
    await expect
      .poll(async () => ((await getState(page)).play as { page: number }).page, { timeout: 10_000 })
      .toBe(2);
    watch.expectNoErrors();
  });
});
