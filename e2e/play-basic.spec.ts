import { expect, test, type Page } from '@playwright/test';
import { addFixtureScore, getState, MEDIAPIPE_LOG_IGNORE, openApp, replayTrace, watchErrors } from './helpers';

type PlayState = { page: number; half: boolean; pageCount: number };

async function play(page: Page): Promise<PlayState> {
  return (await getState(page)).play as PlayState;
}

async function expectPlay(page: Page, want: Partial<PlayState>): Promise<void> {
  await expect.poll(async () => play(page), { timeout: 10_000 }).toMatchObject(want);
}

async function openPlay(page: Page): Promise<string> {
  const id = await addFixtureScore(page, 'score-3.pdf', 'Тест', 3);
  await page.evaluate((i) => window.__notyTest!.navigate(`/play/${i}`), id);
  await expect(page.getByTestId('play-root')).toBeVisible();
  await expectPlay(page, { pageCount: 3 });
  return id;
}

async function tapZone(page: Page, zone: 'left' | 'right', y = 0.6): Promise<void> {
  const box = await page.getByTestId('play-root').boundingBox();
  if (!box) throw new Error('no play-root');
  const x = box.x + box.width * (zone === 'left' ? 0.1 : 0.9);
  await page.mouse.click(x, box.y + box.height * y);
}

test.describe('play basics', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('noty.coach.v1', '3'));
  });

  test('keys turn pages and show the end pulse', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { settings: { gesture: 'off' } });
    await openPlay(page);
    await expectPlay(page, { page: 1, half: false, pageCount: 3 });
    await page.keyboard.press('ArrowRight');
    await expectPlay(page, { page: 1, half: true });
    await page.keyboard.press('ArrowRight');
    await expectPlay(page, { page: 2, half: false });
    await page.keyboard.press('ArrowLeft');
    await expectPlay(page, { page: 1 });
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
    await expectPlay(page, { page: 3 });
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('play-end')).toBeVisible();
    watch.expectNoErrors();
  });

  test('touch zones turn pages', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { settings: { gesture: 'off', halfPage: false } });
    await openPlay(page);
    await page.keyboard.press('ArrowRight');
    await expectPlay(page, { page: 2, half: false });
    await tapZone(page, 'right');
    await expectPlay(page, { page: 3 });
    await tapZone(page, 'left');
    await expectPlay(page, { page: 2 });
    watch.expectNoErrors();
  });

  test('restores the last page', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { settings: { gesture: 'off', halfPage: false } });
    const id = await openPlay(page);
    await page.keyboard.press('ArrowRight');
    await expectPlay(page, { page: 2 });
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__notyTest!.navigate('/'));
    await page.evaluate((i) => window.__notyTest!.navigate(`/play/${i}`), id);
    await expectPlay(page, { page: 2, pageCount: 3 });
    watch.expectNoErrors();
  });

  test('a head turn replayed from a trace goes forward', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page);
    await openPlay(page);
    await replayTrace(page, 'turn-right-hold');
    await expect.poll(async () => (await play(page)).page * 2 + ((await play(page)).half ? 1 : 0), { timeout: 10_000 }).toBeGreaterThan(2);
    watch.expectNoErrors();
  });

  test('camera denied keeps touch and keys working', async ({ page }) => {
    const watch = watchErrors(page, { ignore: [/NotAllowedError|denied/i, ...MEDIAPIPE_LOG_IGNORE] });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: () => Promise.reject(new DOMException('denied', 'NotAllowedError')), enumerateDevices: () => Promise.resolve([]) },
      });
    });
    await openApp(page, { query: 'camera=1', settings: { halfPage: false } });
    await openPlay(page);
    await expect(page.getByTestId('play-camera-banner')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('play-camera-retry')).toBeAttached();
    await page.keyboard.press('ArrowRight');
    await expectPlay(page, { page: 2 });
    await tapZone(page, 'right', 0.7);
    await expectPlay(page, { page: 3 });
    await page.getByTestId('play-camera-close').click();
    await expect(page.getByTestId('play-camera-banner')).toBeHidden();
    watch.expectNoErrors();
  });
});

test.describe('play coach', () => {
  test('first-use hint shows once, closes on tap', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { settings: { gesture: 'off', halfPage: false } });
    await openPlay(page);
    const coach = page.getByTestId('play-coach');
    await expect(coach).toBeVisible();
    await coach.click();
    await expect(coach).toBeHidden();
    await tapZone(page, 'right');
    await expectPlay(page, { page: 2 });
    watch.expectNoErrors();
  });
});
