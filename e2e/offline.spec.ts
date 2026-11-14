import { test, expect } from '@playwright/test';
import { addFixtureScore, openApp, watchErrors } from './helpers';

test.use({ serviceWorkers: 'allow' });

test('the app, the fonts and a stored score work offline', async ({ page, context }) => {
  test.setTimeout(120_000);
  const watch = watchErrors(page);

  // The service worker registers in test mode only with ?sw=1.
  await openApp(page, { onboarded: true, query: 'sw=1' });
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.ready.then(() => true)), { timeout: 90_000 })
    .toBe(true);
  await page.reload();
  await page.waitForFunction(() => !!window.__notyTest);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 90_000 });

  const id = await addFixtureScore(page, 'score-3.pdf', 'Офлайн-тест', 3);

  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => !!window.__notyTest);
  await expect(page.getByTestId('screen-library')).toBeVisible();

  const fontsLoaded = await page.evaluate(async () => {
    await document.fonts.load('600 32px "Cormorant Garamond"', 'Ноти');
    await document.fonts.ready;
    return document.fonts.check('600 32px "Cormorant Garamond"', 'Ноти');
  });
  expect(fontsLoaded).toBe(true);

  const helpers = await page.evaluate(async () => {
    const cmap = await fetch(new URL('pdfjs/cmaps/78-H.bcmap', document.baseURI));
    const font = await fetch(new URL('pdfjs/standard_fonts/FoxitFixed.pfb', document.baseURI));
    return { cmap: cmap.ok, font: font.ok };
  });
  expect(helpers).toEqual({ cmap: true, font: true });

  const rendered = await page.evaluate(async (scoreId) => {
    const hook = window.__notyTest!;
    const data = await hook.storage.getScoreData(scoreId);
    if (!data) return null;
    const pdf = await hook.modules.pdf.openPdf(data);
    const canvas = await pdf.renderPage(1, { cssWidth: 300, dpr: 1 });
    return { pageCount: pdf.pageCount, width: canvas.width };
  }, id);
  expect(rendered).not.toBeNull();
  expect(rendered!.pageCount).toBe(3);
  expect(rendered!.width).toBeGreaterThan(0);

  watch.expectNoErrors();
});
