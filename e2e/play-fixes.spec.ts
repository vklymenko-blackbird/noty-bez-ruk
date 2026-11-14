import { expect, test, type Page } from '@playwright/test';
import { addFixtureScore, fixturePath, getState, openApp, watchErrors } from './helpers';

async function openPlay(page: Page): Promise<void> {
  const id = await addFixtureScore(page, 'score-3.pdf', 'Тест', 3);
  await page.evaluate((i) => window.__notyTest!.navigate(`/play/${i}`), id);
  await expect(page.getByTestId('play-root')).toBeVisible();
  await expect.poll(async () => ((await getState(page)).play as { pageCount: number } | undefined)?.pageCount).toBe(3);
}

/** True when the element at the centre of the test id is the element itself or inside it. */
async function centreHits(page: Page, testId: string): Promise<boolean> {
  return page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit !== null && el.contains(hit);
  }, testId);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('noty.coach.v1', '3'));
});

test('a touch tap in the centre opens the controls sheet and keeps it open', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 744, height: 1133 }, baseURL: 'http://localhost:' + new URL(test.info().project.use.baseURL ?? '').port + '/noty-bez-ruk/' });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('noty.coach.v1', '3'));
  const watch = watchErrors(page);
  await openApp(page, { settings: { gesture: 'off' } });
  await openPlay(page);
  await page.touchscreen.tap(372, 560);
  await expect(page.getByTestId('controls-sheet')).toBeVisible();
  await page.waitForTimeout(700);
  await expect(page.getByTestId('controls-sheet')).toBeVisible();
  watch.expectNoErrors();
  await context.close();
});

for (const size of [
  { width: 744, height: 1133 },
  { width: 1133, height: 744 },
]) {
  test(`play screen is full-bleed at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openApp(page, { settings: { gesture: 'off' } });
    await openPlay(page);
    const box = await page.getByTestId('play-root').boundingBox();
    expect(box).toEqual({ x: 0, y: 0, width: size.width, height: size.height });
    const doc = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth }));
    expect(doc.h).toBeLessThanOrEqual(size.height);
    expect(doc.w).toBeLessThanOrEqual(size.width);
  });
}

test('the wake hint toast does not cover the controls sheet buttons', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined });
  });
  await openApp(page, { settings: { gesture: 'off' } });
  await openPlay(page);
  await expect(page.getByTestId('toast')).toBeVisible();
  await page.mouse.click(372, 560);
  await expect(page.getByTestId('controls-sheet')).toBeVisible();
  await expect(page.getByTestId('toast')).toBeVisible();
  expect(await centreHits(page, 'ctl-annotate')).toBe(true);
  expect(await centreHits(page, 'ctl-exit')).toBe(true);
  const [toastBox, exitBox] = await Promise.all([page.getByTestId('toast').boundingBox(), page.getByTestId('ctl-exit').boundingBox()]);
  expect(toastBox!.y + toastBox!.height).toBeLessThanOrEqual(exitBox!.y);
});

test('the import toast does not cover the «Відкрити PDF» button', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('input-file').setInputFiles([fixturePath('score-3.pdf')]);
  await expect(page.getByTestId('score-card')).toHaveCount(1);
  await page.getByTestId('input-file').setInputFiles([fixturePath('score-12.pdf')]);
  await expect(page.getByTestId('toast').first()).toBeVisible();
  expect(await centreHits(page, 'btn-open-pdf')).toBe(true);
  expect(await centreHits(page, 'btn-find')).toBe(true);
  const [toastBox, openBox] = await Promise.all([page.getByTestId('toast').first().boundingBox(), page.getByTestId('btn-open-pdf').boundingBox()]);
  const overlap = toastBox!.y < openBox!.y + openBox!.height && toastBox!.y + toastBox!.height > openBox!.y;
  expect(overlap).toBe(false);
});

async function openNotes(page: Page): Promise<void> {
  await openApp(page, { settings: { gesture: 'off' } });
  await openPlay(page);
  const size = page.viewportSize()!;
  await page.mouse.click(size.width / 2, size.height / 2);
  await page.getByTestId('ctl-annotate').click();
  await expect(page.getByTestId('annot-toolbar')).toBeVisible();
}

for (const size of [
  { width: 744, height: 1133 },
  { width: 1133, height: 744 },
]) {
  test(`note toolbar fits without scroll at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openNotes(page);
    const ids = ['annot-cancel', 'color-ink', 'color-burgundy', 'color-blue', 'tool-highlighter', 'tool-eraser', 'tool-stamp-1', 'tool-stamp-5', 'annot-undo', 'annot-redo', 'annot-clear', 'annot-done'];
    for (const id of ids) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, id).not.toBeNull();
      expect(box!.x, id).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, id).toBeLessThanOrEqual(size.width);
      expect(box!.y + box!.height, id).toBeLessThanOrEqual(size.height);
      expect(box!.width, id).toBeGreaterThanOrEqual(44);
      expect(box!.height, id).toBeGreaterThanOrEqual(44);
    }
    const overflow = await page.evaluate(() => {
      const bar = document.querySelector('[data-testid="annot-toolbar"]') as HTMLElement;
      return [...bar.querySelectorAll<HTMLElement>('.annot-toolbar__row')].some((r) => r.scrollWidth > r.clientWidth);
    });
    expect(overflow).toBe(false);
    await expect(page.getByTestId('annot-done')).toContainText('Зберегти');
  });
}

test('a finger in note mode shows the pen-only hint once per note session', async ({ page }) => {
  await openNotes(page);
  const layer = page.getByTestId('annot-layer');
  await layer.tap({ position: { x: 100, y: 200 } });
  const hint = page.getByTestId('toast').filter({ hasText: 'Малюйте Apple Pencil' });
  await expect(hint).toHaveCount(1);
  await page.evaluate(() => document.querySelectorAll('[data-testid="toast"]').forEach((n) => n.remove()));
  await layer.tap({ position: { x: 140, y: 240 } });
  await page.waitForTimeout(300);
  await expect(hint).toHaveCount(0);
});

for (const size of [
  { width: 744, height: 1133 },
  { width: 390, height: 844 },
]) {
  test(`F: the wake hint toast stays below the camera banner when a sheet is open (${size.width} px)`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: () => Promise.reject(new DOMException('denied', 'NotAllowedError')), enumerateDevices: () => Promise.resolve([]) },
      });
    });
    await openApp(page, { query: 'camera=1', settings: { gesture: 'head', halfPage: false } });
    await openPlay(page);
    await expect(page.getByTestId('play-camera-banner')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('toast')).toBeVisible();
    await page.mouse.click(size.width / 2, size.height / 2);
    await expect(page.getByTestId('controls-sheet')).toBeVisible();
    await expect(page.getByTestId('toast')).toBeVisible();
    const [toastBox, bannerBox] = await Promise.all([page.getByTestId('toast').boundingBox(), page.getByTestId('play-camera-banner').boundingBox()]);
    expect(toastBox!.y).toBeGreaterThanOrEqual(bannerBox!.y + bannerBox!.height);
  });
}
