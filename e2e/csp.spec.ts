import { test, expect } from '@playwright/test';
import { MEDIAPIPE_LOG_IGNORE, addFixtureScore, getState, openApp, watchErrors } from './helpers';

// Chromium only: no @webkit tag, so the webkit project skips this spec.

test.describe('csp and console are clean', () => {
  test.setTimeout(90_000);

  test('every route opens without a CSP violation or console error', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { settings: { gesture: 'off' } });
    const id = await addFixtureScore(page, 'score-3.pdf', 'Тест CSP', 3);

    const routes: [string, string][] = [
      ['/', 'screen-library'],
      ['/search', 'screen-search'],
      ['/settings', 'screen-settings'],
      ['/onboarding', 'screen-onboarding'],
      [`/score/${id}`, 'screen-score'],
      [`/play/${id}`, 'play-root'],
    ];
    for (const [path, testId] of routes) {
      await page.evaluate((p) => window.__notyTest!.navigate(p), path);
      await expect(page.getByTestId(testId).first(), path).toBeVisible();
      await page.waitForTimeout(300);
    }
    await expect(page.getByTestId('pv-layer').first()).toBeVisible();
    watch.expectNoErrors();
  });

  test('play with the real fake camera calibrates', async ({ page }) => {
    const watch = watchErrors(page, { ignore: MEDIAPIPE_LOG_IGNORE });
    await openApp(page, { query: 'camera=1' });
    const id = await addFixtureScore(page, 'score-3.pdf', 'Тест камера', 3);
    await page.evaluate((i) => window.__notyTest!.navigate(`/play/${i}`), id);
    await expect(page.getByTestId('play-root')).toBeVisible();

    await expect
      .poll(
        async () => {
          const g = (await getState(page)).gesture as { status?: string; state?: { phase?: string } } | undefined;
          return `${g?.status}/${g?.state?.phase}`;
        },
        { timeout: 60_000, intervals: [500] },
      )
      .toMatch(/^running\/(calibrating|neutral)$/);
    watch.expectNoErrors();
  });
});
