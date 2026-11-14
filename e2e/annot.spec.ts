import { test, expect, type Page } from '@playwright/test';
import { addFixtureScore, openApp, watchErrors } from './helpers';

/** Page fraction (0..1 of the page box) to viewport pixels. */
async function at(page: Page, fx: number, fy: number): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId('annot-layer').boundingBox();
  if (!box) throw new Error('annot-layer has no box');
  return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}

async function drag(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  const a = await at(page, from[0], from[1]);
  const b = await at(page, to[0], to[1]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}

async function tap(page: Page, fx: number, fy: number): Promise<void> {
  const p = await at(page, fx, fy);
  await page.mouse.click(p.x, p.y);
}

/** Opens the note mode of a fresh copy of score-3.pdf. */
async function openNoteMode(page: Page): Promise<void> {
  await openApp(page);
  const id = await addFixtureScore(page, 'score-3.pdf', 'Тестові ноти', 3);
  await page.evaluate((scoreId) => window.__notyTest!.navigate(`/dev/annot/${scoreId}`), id);
  await expect(page.getByTestId('annot-layer')).toBeVisible();
  await expect(page.getByTestId('dev-marks')).toHaveText('0');
}

test('note mode: draw, undo, redo, stamp, erase, save and reload', async ({ page }) => {
  const watch = watchErrors(page);
  await openNoteMode(page);

  await drag(page, [0.2, 0.3], [0.6, 0.35]);
  await expect(page.getByTestId('dev-marks')).toHaveText('1');

  await page.getByTestId('annot-undo').click();
  await expect(page.getByTestId('dev-marks')).toHaveText('0');
  await page.getByTestId('annot-redo').click();
  await expect(page.getByTestId('dev-marks')).toHaveText('1');

  await page.getByTestId('tool-stamp-3').click();
  await tap(page, 0.5, 0.7);
  await expect(page.getByTestId('dev-marks')).toHaveText('2');

  await page.getByTestId('tool-eraser').click();
  await drag(page, [0.4, 0.2], [0.4, 0.45]);
  await expect(page.getByTestId('dev-marks')).toHaveText('1');

  await page.getByTestId('annot-done').click();
  await expect(page.getByTestId('dev-done-count')).toHaveText('1');

  await page.reload();
  await page.waitForFunction(() => !!window.__notyTest);
  await expect(page.getByTestId('dev-marks')).toHaveText('1');

  watch.expectNoErrors();
});

test('note mode: cancel returns to the saved marks', async ({ page }) => {
  const watch = watchErrors(page);
  await openNoteMode(page);

  await expect(page.getByTestId('dev-marks')).toHaveText('0');
  await page.getByTestId('tool-stamp-1').click();
  await tap(page, 0.5, 0.5);
  await expect(page.getByTestId('dev-marks')).toHaveText('1');
  await page.getByTestId('annot-done').click();
  await expect(page.getByTestId('dev-done-count')).toHaveText('1');

  await drag(page, [0.2, 0.6], [0.8, 0.62]);
  await expect(page.getByTestId('dev-marks')).toHaveText('2');
  await page.getByTestId('annot-cancel').click();
  await expect(page.getByTestId('dev-marks')).toHaveText('1');

  watch.expectNoErrors();
});

test('note mode: a drawn line leaves ink pixels on the canvas', async ({ page }) => {
  const watch = watchErrors(page);
  await openNoteMode(page);

  await drag(page, [0.2, 0.3], [0.8, 0.3]);
  await expect(page.getByTestId('dev-marks')).toHaveText('1');

  const inked = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="annot-layer"]');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return -1;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) count += 1;
    }
    return count;
  });
  expect(inked).toBeGreaterThan(0);

  watch.expectNoErrors();
});

test('note mode: a failed save shows an error and keeps the marks', async ({ page }) => {
  const watch = watchErrors(page);
  await openNoteMode(page);

  await page.evaluate(() => {
    window.__notyTest!.storage.setMarks = () => Promise.reject(new Error('disk full'));
  });
  await drag(page, [0.2, 0.3], [0.7, 0.35]);
  await expect(page.getByTestId('dev-marks')).toHaveText('1');

  await page.getByTestId('annot-done').click();
  await expect(page.getByText('Не вдалося зберегти позначки', { exact: false })).toBeVisible();
  await expect(page.getByTestId('dev-done-count')).toHaveText('0');
  await expect(page.getByTestId('dev-marks')).toHaveText('1');
  await expect(page.getByTestId('annot-done')).toBeEnabled();

  watch.expectNoErrors();
});

test('note mode: undo is disabled when there is nothing to undo', async ({ page }) => {
  const watch = watchErrors(page);
  await openNoteMode(page);

  await expect(page.getByTestId('annot-undo')).toBeDisabled();
  await expect(page.getByTestId('annot-redo')).toBeDisabled();

  watch.expectNoErrors();
});
