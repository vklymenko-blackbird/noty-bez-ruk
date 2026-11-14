import { expect, test } from '@playwright/test';
import { addFixtureScore, getState, openApp } from './helpers';

// Chromium only: no @webkit tag.
test.describe('render failure does not trap touch users (F6)', () => {
  test.setTimeout(60_000);

  test('on the error panel an edge tap turns the page and a centre tap opens the controls sheet and exit works', async ({ browser }) => {
    const port = new URL(test.info().project.use.baseURL ?? '').port;
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 744, height: 1133 },
      deviceScaleFactor: 2,
      locale: 'uk-UA',
      serviceWorkers: 'block',
      baseURL: `http://localhost:${port}/noty-bez-ruk/`,
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('noty.coach.v1', '3');
      // When the flag is set, every canvas 2D context request fails, so every PDF page render fails.
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: unknown[]) {
        if ((window as unknown as { __failRender?: boolean }).__failRender) throw new Error('forced render failure');
        return (orig as (...a: unknown[]) => unknown).apply(this, args);
      } as typeof orig;
    });
    await openApp(page, { settings: { gesture: 'off', halfPage: false } });
    const id = await addFixtureScore(page, 'score-3.pdf', 'Тест', 3);
    await page.evaluate(() => ((window as unknown as { __failRender: boolean }).__failRender = true));
    await page.evaluate((i) => window.__notyTest!.navigate(`/play/${i}`), id);
    await expect(page.getByTestId('play-root')).toBeVisible();
    await expect(page.getByTestId('pv-error')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('pv-error')).toContainText('сторінку 1');

    // An edge tap on the panel (not on the button) turns the page.
    await page.touchscreen.tap(700, 300);
    await expect.poll(async () => ((await getState(page)).play as { page: number }).page).toBe(2);
    await expect(page.getByTestId('pv-error')).toContainText('сторінку 2');

    // A centre tap on the panel opens the controls sheet.
    await page.touchscreen.tap(372, 300);
    await expect(page.getByTestId('controls-sheet')).toBeVisible();
    await page.getByTestId('ctl-exit').tap();
    await expect(page.getByTestId('play-root')).toHaveCount(0);
    await context.close();
  });
});
