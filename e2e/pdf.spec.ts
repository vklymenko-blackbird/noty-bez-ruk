import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fixturePath, openApp, watchErrors } from './helpers';

function fixtureBase64(name: string): string {
  return readFileSync(fixturePath(name)).toString('base64');
}

test('pdf engine opens, sizes and renders pages from the bundle', async ({ page }) => {
  const watch = watchErrors(page);
  await openApp(page);
  const b64 = fixtureBase64('score-12.pdf');

  const result = await page.evaluate(async (data) => {
    const pdf = window.__notyTest!.modules.pdf;
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)).buffer;
    const doc = await pdf.openPdf(bytes);
    const size = await doc.getPageSize(1);
    const full = await doc.renderPage(1, { cssWidth: 300, dpr: 2 });
    const fullCtx = full.getContext('2d')!;
    const fullData = fullCtx.getImageData(0, 0, full.width, full.height).data;
    let nonWhite = 0;
    for (let i = 0; i < fullData.length; i += 4) {
      if (fullData[i] < 250 || fullData[i + 1] < 250 || fullData[i + 2] < 250) nonWhite += 1;
    }
    const cropped = await doc.renderPage(1, { cssWidth: 300, dpr: 2, crop: { x: 0.2, y: 0.2, w: 0.6, h: 0.6 } });
    await doc.destroy();
    let afterDestroy = 'resolved';
    try {
      await doc.renderPage(1, { cssWidth: 300, dpr: 2 });
    } catch {
      afterDestroy = 'rejected';
    }
    return {
      pageCount: doc.pageCount,
      size,
      fullWidth: full.width,
      nonWhite,
      croppedWidth: cropped.width,
      croppedHeight: cropped.height,
      afterDestroy,
    };
  }, b64);

  expect(result.pageCount).toBe(12);
  expect(Math.abs(result.size.width - 595)).toBeLessThanOrEqual(2);
  expect(Math.abs(result.size.height - 842)).toBeLessThanOrEqual(2);
  expect(result.fullWidth).toBe(600);
  expect(result.nonWhite).toBeGreaterThan(100);
  expect(result.croppedWidth).toBe(600);
  expect(Math.abs(result.croppedHeight - (600 * 842) / 595)).toBeLessThanOrEqual(2);
  expect(result.afterDestroy).toBe('rejected');
  watch.expectNoErrors();
});

test('a corrupt PDF rejects with pdf-open-failed', async ({ page }) => {
  const watch = watchErrors(page);
  await openApp(page);
  const b64 = fixtureBase64('corrupt.pdf');

  const code = await page.evaluate(async (data) => {
    const pdf = window.__notyTest!.modules.pdf;
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)).buffer;
    try {
      await pdf.openPdf(bytes);
      return 'opened';
    } catch (e) {
      return (e as { code?: string }).code ?? 'unknown';
    }
  }, b64);

  expect(code).toBe('pdf-open-failed');
  watch.expectNoErrors();
});

test('old browser: pdf opens and renders when newer JS APIs are missing on the main thread', async ({ page }) => {
  // Removes the APIs that an older iPadOS does not have, before any app code runs.
  await page.addInitScript(() => {
    const drop = (obj: object, key: string) => {
      try {
        delete (obj as Record<string, unknown>)[key];
      } catch {
        /* ignore */
      }
    };
    drop(Map.prototype, 'getOrInsertComputed');
    drop(WeakMap.prototype, 'getOrInsertComputed');
    drop(Promise, 'try');
    drop(Uint8Array, 'fromBase64');
    drop(Math, 'sumPrecise');
  });
  const watch = watchErrors(page);
  await openApp(page);
  const b64 = fixtureBase64('score-3.pdf');

  const nonWhite = await page.evaluate(async (data) => {
    const pdf = window.__notyTest!.modules.pdf;
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)).buffer;
    const doc = await pdf.openPdf(bytes);
    const canvas = await doc.renderPage(1, { cssWidth: 300, dpr: 2 });
    const px = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] < 250 || px[i + 1] < 250 || px[i + 2] < 250) count += 1;
    }
    await doc.destroy();
    return count;
  }, b64);

  expect(nonWhite).toBeGreaterThan(100);
  watch.expectNoErrors();
});
