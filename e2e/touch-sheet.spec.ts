import { expect, test, type Browser, type Page } from '@playwright/test';
import { addFixtureScore, getState, openApp, watchErrors } from './helpers';

/**
 * Why the old test passed: its tap came less than 400 ms after the page loaded. The old guard compared
 * performance.now() (time since page load) with 0, because it was set inside an effect that had not run yet,
 * so a young page ignored the ghost click by luck. A real player has the page open for much longer.
 *
 * A touch tap in the centre of the play page opens the controls sheet on pointerup.
 * The browser then sends the click of that same tap to the new scrim. That click must not close the sheet.
 * The old test tapped once and looked at the result without waiting for that click, so it did not catch this.
 */

async function touchPage(browser: Browser, width = 744, height = 1133): Promise<Page> {
  const port = new URL(test.info().project.use.baseURL ?? '').port;
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width, height },
    deviceScaleFactor: 2,
    locale: 'uk-UA',
    serviceWorkers: 'block',
    baseURL: `http://localhost:${port}/noty-bez-ruk/`,
  });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('noty.coach.v1', '3'));
  return page;
}

async function openPlay(page: Page): Promise<string> {
  const id = await addFixtureScore(page, 'score-3.pdf', 'Тест', 3);
  await page.evaluate((i) => window.__notyTest!.navigate(`/play/${i}`), id);
  await expect(page.getByTestId('play-root')).toBeVisible();
  await expect.poll(async () => ((await getState(page)).play as { pageCount: number } | undefined)?.pageCount).toBe(3);
  await expect(page.locator('[data-testid=pv] canvas').first()).toBeVisible();
  // The page must be older than the old 400 ms ghost window, as it is in real use.
  await page.waitForFunction(() => performance.now() > 1500);
  return id;
}

/**
 * Makes animation frames slow, like a busy iPad. Preact runs effects after a frame or after 100 ms,
 * so the ghost click (a few ms after pointerup) then arrives before the effects of the new sheet.
 * That order broke the old guard, which was set inside an effect. The tap point of the old test hid it:
 * its click hit the sheet body, or the effects ran first on a fast machine.
 */
async function slowFrames(page: Page): Promise<void> {
  await page.evaluate(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => window.setTimeout(() => raf(cb), 250);
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  });
}

/** Resolves with the number of clicks seen after the call, once the first one arrived and two frames passed. */
function armClickWatch(page: Page): Promise<void> {
  return page.evaluate(() => {
    const w = window as unknown as { __clicks: Promise<number> };
    w.__clicks = new Promise<number>((resolve) => {
      let n = 0;
      document.addEventListener(
        'click',
        () => {
          n++;
          // Let the effects, mutation and the frame after the click run.
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(n)));
        },
        { capture: true, once: true },
      );
    });
  });
}

async function afterClick(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as { __clicks: Promise<number> }).__clicks);
}

for (const point of [
  { name: 'centre', x: 372, y: 560 },
  { name: 'upper third', x: 372, y: 200 },
  { name: 'lower third', x: 372, y: 900 },
])
  for (const slow of [false, true]) {
  test(`a touch tap at the ${point.name} of the play page opens the controls sheet and the ghost click does not close it (${slow ? 'slow frames' : 'fast frames'}) @webkit`, async ({ browser }) => {
    const page = await touchPage(browser);
    const watch = watchErrors(page);
    await openApp(page, { settings: { gesture: 'off', halfPage: false } });
    await openPlay(page);
    if (slow) await slowFrames(page);
    await armClickWatch(page);
    await page.touchscreen.tap(point.x, point.y);
    await expect(page.getByTestId('controls-sheet')).toBeVisible();
    await afterClick(page);
    await expect(page.getByTestId('controls-sheet')).toBeVisible();
    // A second real tap on the scrim closes it.
    await page.touchscreen.tap(372, 60);
    await expect(page.getByTestId('controls-sheet')).toHaveCount(0);
    watch.expectNoErrors();
    await page.context().close();
  });
  }

test('landscape: a touch tap in the centre opens the controls sheet and keeps it open', async ({ browser }) => {
  const page = await touchPage(browser, 1133, 744);
  await openApp(page, { settings: { gesture: 'off', halfPage: false } });
  await openPlay(page);
  await armClickWatch(page);
  await page.touchscreen.tap(566, 372);
  await expect(page.getByTestId('controls-sheet')).toBeVisible();
  await afterClick(page);
  await expect(page.getByTestId('controls-sheet')).toBeVisible();
  await page.context().close();
});

async function tapCentreOf(page: Page, testId: string): Promise<void> {
  const box = await page.getByTestId(testId).boundingBox();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

test('score menu, rename and delete sheets opened by a touch tap close on a real scrim tap @webkit', async ({ browser }) => {
  const page = await touchPage(browser);
  const watch = watchErrors(page);
  await openApp(page, { settings: { gesture: 'off' } });
  const id = await addFixtureScore(page, 'score-3.pdf', 'Тест', 3);
  await page.evaluate((i) => window.__notyTest!.navigate(`/score/${i}`), id);
  await expect(page.getByTestId('btn-more')).toBeVisible();

  // The menu itself.
  await armClickWatch(page);
  await tapCentreOf(page, 'btn-more');
  await expect(page.getByTestId('score-menu')).toBeVisible();
  await afterClick(page);
  await expect(page.getByTestId('score-menu')).toBeVisible();
  await page.touchscreen.tap(372, 40);
  await expect(page.getByTestId('score-menu')).toHaveCount(0);

  // Rename and delete, each opened from the menu.
  for (const [button, sheet] of [
    ['btn-rename', 'rename-sheet'],
    ['btn-delete', 'confirm-sheet'],
  ] as const) {
    await tapCentreOf(page, 'btn-more');
    await expect(page.getByTestId('score-menu')).toBeVisible();
    await armClickWatch(page);
    await tapCentreOf(page, button);
    await expect(page.getByTestId(sheet)).toBeVisible();
    await afterClick(page);
    await expect(page.getByTestId(sheet)).toBeVisible();
    await page.touchscreen.tap(372, 40);
    await expect(page.getByTestId(sheet)).toHaveCount(0);
  }
  watch.expectNoErrors();
  await page.context().close();
});

test('the «Як увімкнути» sheet opened by a touch tap stays open and closes on a real scrim tap', async ({ browser }) => {
  const page = await touchPage(browser);
  // The camera is denied, so the play page shows the camera banner.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => Promise.reject(new DOMException('denied', 'NotAllowedError')), enumerateDevices: () => Promise.resolve([]) },
    });
  });
  await openApp(page, { query: 'camera=1', settings: { gesture: 'head', halfPage: false } });
  await openPlay(page);
  await page.waitForFunction(() => performance.now() > 1500);
  const how = page.getByTestId('play-camera-how');
  await expect(how).toBeVisible({ timeout: 20_000 });
  await armClickWatch(page);
  const box = await how.boundingBox();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page.getByRole('dialog')).toBeVisible();
  await afterClick(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.touchscreen.tap(372, 40);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.context().close();
});
