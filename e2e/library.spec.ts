import { test, expect } from '@playwright/test';
import { openApp, fixturePath, watchErrors } from './helpers';

test('empty library shows the install banner and the empty state', async ({ page }) => {
  const watch = watchErrors(page);
  await openApp(page);
  await expect(page.getByTestId('screen-library')).toBeVisible();
  await expect(page.getByTestId('library-install')).toBeVisible();
  await expect(page.getByTestId('library-empty')).toBeVisible();
  watch.expectNoErrors();
});

test('importing three PDFs shows three cards', async ({ page }) => {
  const watch = watchErrors(page);
  await openApp(page);
  await page.getByTestId('input-file').setInputFiles([
    fixturePath('score-3.pdf'),
    fixturePath('score-12.pdf'),
    fixturePath('landscape-1.pdf'),
  ]);
  await expect(page.getByTestId('score-card')).toHaveCount(3);
  await expect(page.getByText('стор. 1 з 12')).toBeVisible();
  await expect(page.getByTestId('library-empty')).toHaveCount(0);
  watch.expectNoErrors();
});

test('a file that is not a PDF shows an error and adds no card', async ({ page }) => {
  const watch = watchErrors(page);
  await openApp(page);
  await page.getByTestId('input-file').setInputFiles([fixturePath('not-a-pdf.pdf')]);
  await expect(page.getByText('Це не PDF-файл: not-a-pdf.pdf')).toBeVisible();
  await expect(page.getByTestId('score-card')).toHaveCount(0);
  watch.expectNoErrors();
});

test('tapping a card opens the score, and the find button opens search', async ({ page }) => {
  const watch = watchErrors(page);
  await openApp(page);
  await page.getByTestId('input-file').setInputFiles([fixturePath('score-3.pdf')]);
  const card = page.getByTestId('score-card');
  await expect(card).toHaveCount(1);
  const id = await card.getAttribute('data-id');
  await card.click();
  await expect.poll(() => new URL(page.url()).hash).toBe('#/score/' + id);

  await page.evaluate(() => window.__notyTest!.navigate('/'));
  await expect(page.getByTestId('screen-library')).toBeVisible();
  await page.getByTestId('btn-find').click();
  await expect.poll(() => new URL(page.url()).hash).toBe('#/search');
  watch.expectNoErrors();
});
