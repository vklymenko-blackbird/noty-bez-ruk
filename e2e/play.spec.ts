import { expect, test, type Page } from '@playwright/test';
import { addFixtureScore, getState, openApp, replayTrace, watchErrors } from './helpers';

type PlayState = { page: number; half: boolean; pageCount: number; annotating: boolean; sheetOpen: boolean; paper: string };

async function play(page: Page): Promise<PlayState> {
  return (await getState(page)).play as PlayState;
}

async function expectPlay(page: Page, want: Partial<PlayState>): Promise<void> {
  await expect.poll(async () => play(page), { timeout: 10_000 }).toMatchObject(want);
}

async function openPlay(page: Page, pages = 12): Promise<string> {
  const id = await addFixtureScore(page, 'score-12.pdf', 'Тест 12', pages);
  await page.evaluate((i) => window.__notyTest!.navigate(`/play/${i}`), id);
  await expect(page.getByTestId('play-root')).toBeVisible();
  await expectPlay(page, { pageCount: pages });
  await expect(page.getByTestId('pv-layer').first()).toBeVisible();
  return id;
}

async function tapAt(page: Page, fx: number, fy = 0.6): Promise<void> {
  const box = await page.getByTestId('play-root').boundingBox();
  if (!box) throw new Error('no play-root');
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

async function swipeLeft(page: Page): Promise<void> {
  const box = await page.getByTestId('play-root').boundingBox();
  if (!box) throw new Error('no play-root');
  const y = box.y + box.height * 0.5;
  await page.mouse.move(box.x + box.width * 0.8, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, y, { steps: 6 });
  await page.mouse.up();
}

/** Replays a calibrating trace that does not turn, and waits until the overlay is gone. */
async function calibrate(page: Page): Promise<void> {
  await replayTrace(page, 'glance-short');
  await expect(page.getByTestId('calib-overlay')).toHaveCount(0, { timeout: 10_000 });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('noty.coach.v1', '3'));
});

test.describe('play: gestures', () => {
  test('the overlay shows, a right turn goes half then full, a left turn goes back', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page);
    await openPlay(page);
    await expect(page.getByTestId('calib-overlay')).toBeVisible();
    await replayTrace(page, 'turn-right-hold');
    await expectPlay(page, { page: 1, half: true });
    await expect(page.locator('[data-testid="pv-layer"][data-page="2"]')).toBeVisible();
    await expect(page.getByTestId('pv-divider')).toBeVisible();
    await expect(page.getByTestId('hud-dot')).toBeVisible();
    await replayTrace(page, 'turn-right-hold');
    await expectPlay(page, { page: 2, half: false });
    await replayTrace(page, 'turn-left-hold');
    await expectPlay(page, { page: 1, half: false });
    watch.expectNoErrors();
  });

  test('a short glance and nodding do not turn', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page);
    await openPlay(page);
    await replayTrace(page, 'glance-short');
    await expect(page.getByTestId('calib-overlay')).toHaveCount(0, { timeout: 10_000 });
    await replayTrace(page, 'nod-noise');
    await page.waitForTimeout(300);
    await expectPlay(page, { page: 1, half: false });
    watch.expectNoErrors();
  });
});

test.describe('play: touch and keys', () => {
  test('taps, keys and a swipe turn pages after calibration', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { settings: { halfPage: false } });
    await openPlay(page);
    await calibrate(page);
    await tapAt(page, 0.9);
    await expectPlay(page, { page: 2 });
    await tapAt(page, 0.1);
    await expectPlay(page, { page: 1 });
    await page.keyboard.press('PageDown');
    await expectPlay(page, { page: 2 });
    await page.keyboard.press('Space');
    await expectPlay(page, { page: 3 });
    await page.keyboard.press('ArrowLeft');
    await expectPlay(page, { page: 2 });
    await swipeLeft(page);
    await expectPlay(page, { page: 3 });
    watch.expectNoErrors();
  });

  test('with gesture off there is no overlay and no dot', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { settings: { gesture: 'off', halfPage: false } });
    await openPlay(page);
    await expect(page.getByTestId('calib-overlay')).toHaveCount(0);
    await expect(page.getByTestId('hud-dot')).toHaveCount(0);
    await tapAt(page, 0.9);
    await expectPlay(page, { page: 2 });
    await page.keyboard.press('ArrowRight');
    await expectPlay(page, { page: 3 });
    watch.expectNoErrors();
  });

  test('skipping the camera removes the overlay, keeps touch and stops the camera', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { settings: { halfPage: false } });
    await openPlay(page);
    await page.getByTestId('calib-skip').click();
    await expect(page.getByTestId('calib-overlay')).toHaveCount(0);
    await tapAt(page, 0.9);
    await expectPlay(page, { page: 2 });
    await page.evaluate(() => {
      const set = (v: string) => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
      set('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      set('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(500);
    const gesture = (await getState(page)).gesture as { status?: string } | undefined;
    expect(gesture?.status).not.toBe('running');
    await expect(page.getByTestId('calib-overlay')).toHaveCount(0);
    watch.expectNoErrors();
  });
});

test.describe('play: controls', () => {
  test('a centre tap opens the sheet, and a turn does nothing while it is open', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page);
    await openPlay(page);
    await calibrate(page);
    await tapAt(page, 0.5);
    await expect(page.getByTestId('controls-sheet')).toBeVisible();
    await expectPlay(page, { sheetOpen: true });
    await replayTrace(page, 'turn-right-hold');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await expectPlay(page, { page: 1, half: false });
    watch.expectNoErrors();
  });

  test('night paper is applied and saved in the score', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { settings: { gesture: 'off' } });
    const id = await openPlay(page);
    await tapAt(page, 0.5);
    await page.getByTestId('ctl-paper-night').click();
    await expect(page.locator('[data-testid="pv-layer"].paper-night').first()).toBeVisible();
    await expect
      .poll(() => page.evaluate((i) => window.__notyTest!.storage.getScore(i).then((s) => s?.paper), id))
      .toBe('night');
    watch.expectNoErrors();
  });

  test('half page off makes the next turn a full page', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { settings: { gesture: 'off' } });
    await openPlay(page);
    await tapAt(page, 0.5);
    await page.getByTestId('ctl-half').click();
    await page.getByTestId('sheet-scrim').click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId('controls-sheet')).toBeHidden();
    await page.keyboard.press('ArrowRight');
    await expectPlay(page, { page: 2, half: false });
    watch.expectNoErrors();
  });

  test('the page slider jumps to page 7', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { settings: { gesture: 'off' } });
    await openPlay(page);
    await tapAt(page, 0.5);
    await page.getByTestId('ctl-page').fill('7');
    await expectPlay(page, { page: 7, half: false });
    watch.expectNoErrors();
  });

  test('flip makes the next right turn go to the previous page', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { settings: { halfPage: false } });
    const id = await openPlay(page);
    await page.evaluate((i) => window.__notyTest!.storage.updateScore(i, { lastPage: 5 }), id);
    await page.reload();
    await expectPlay(page, { page: 5, pageCount: 12 });
    await calibrate(page);
    await tapAt(page, 0.5);
    await page.getByTestId('ctl-flip').click();
    await page.getByTestId('sheet-scrim').click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId('controls-sheet')).toBeHidden();
    await replayTrace(page, 'turn-right-hold');
    await expectPlay(page, { page: 4 });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('noty.settings.v1') ?? '{}').flipDirection)).toBe(true);
    watch.expectNoErrors();
  });

  test('exit goes to the score page', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { settings: { gesture: 'off' } });
    const id = await openPlay(page);
    await tapAt(page, 0.5);
    await page.getByTestId('ctl-exit').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#/score/${id}`);
    watch.expectNoErrors();
  });
});

test.describe('play: notes', () => {
  test('a drawn line is saved and survives a reload; navigation is blocked in note mode', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { settings: { gesture: 'off', halfPage: false } });
    const id = await openPlay(page);
    await tapAt(page, 0.5);
    await page.getByTestId('ctl-annotate').click();
    await expect(page.getByTestId('annot-toolbar')).toBeVisible();
    await expectPlay(page, { annotating: true });
    await page.keyboard.press('ArrowRight');
    await tapAt(page, 0.95, 0.9);
    await page.waitForTimeout(200);
    await expectPlay(page, { page: 1, annotating: true });
    const box = await page.getByTestId('annot-layer').boundingBox();
    if (!box) throw new Error('no annot-layer');
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.35, { steps: 8 });
    await page.mouse.up();
    await page.getByTestId('annot-done').click();
    await expectPlay(page, { annotating: false });
    await expect.poll(() => page.evaluate(([i]) => window.__notyTest!.storage.getMarks(i as string, 1).then((m) => m.length), [id])).toBe(1);
    await page.reload();
    await expectPlay(page, { pageCount: 12 });
    await expect
      .poll(() => page.evaluate(([i]) => window.__notyTest!.storage.getMarks(i as string, 1).then((m) => m.length), [id]))
      .toBe(1);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="annot-layer"]');
          const ctx = canvas?.getContext('2d');
          if (!canvas || !ctx || canvas.width === 0) return 0;
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let n = 0;
          for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) n++;
          return n;
        }),
      )
      .toBeGreaterThan(0);
    watch.expectNoErrors();
  });
});

test.describe('play: end and restore', () => {
  test('the end pulse shows, and the last page is restored', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { settings: { gesture: 'off', halfPage: false } });
    const id = await openPlay(page, 3);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expectPlay(page, { page: 3 });
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('play-end')).toBeVisible();
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__notyTest!.navigate('/'));
    await page.evaluate((i) => window.__notyTest!.navigate(`/play/${i}`), id);
    await expectPlay(page, { page: 3, pageCount: 3 });
    watch.expectNoErrors();
  });
});
