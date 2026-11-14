import { test, expect } from '@playwright/test';
import { addFixtureScore, openApp, watchErrors } from './helpers';

test('score detail: title, thumbnails, paper, rename, play and delete', async ({ page }) => {
  const watch = watchErrors(page);
  await page.setViewportSize({ width: 744, height: 1133 });
  await openApp(page);
  const id = await addFixtureScore(page, 'score-12.pdf', 'Тестовий твір', 12, 'Test Composer');
  await page.evaluate((i) => window.__notyTest!.navigate(`/score/${i}`), id);

  await expect(page.getByTestId('screen-score')).toBeVisible();
  await expect(page.getByTestId('score-title')).toHaveText('Тестовий твір');

  // Eight thumbnails, each with a rendered canvas.
  await expect(page.getByTestId('thumb')).toHaveCount(8);
  await expect(page.locator('[data-testid="thumb"] canvas')).toHaveCount(8);

  // Paper choice updates the thumbnail boxes and survives a reload.
  await page.getByTestId('paper-chip-night').click();
  await expect(page.locator('.score-thumb__page.paper-night')).toHaveCount(8);
  await page.reload();
  await page.waitForFunction(() => !!window.__notyTest);
  await expect(page.getByTestId('paper-chip-night')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.score-thumb__page.paper-night')).toHaveCount(8);

  // The page does not scroll sideways at phone width (only the strip scrolls).
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // Rename.
  await page.getByTestId('btn-more').click();
  await page.getByTestId('btn-rename').click();
  await page.getByTestId('rename-title').fill('Новий титул');
  await page.getByTestId('rename-save').click();
  await expect(page.getByTestId('score-title')).toHaveText('Новий титул');

  // Play goes to the play route.
  await page.getByTestId('btn-play').click();
  await expect(page).toHaveURL(new RegExp(`#/play/${id}$`));

  // Delete goes back to the library and removes the score from storage.
  await page.evaluate((i) => window.__notyTest!.navigate(`/score/${i}`), id);
  await expect(page.getByTestId('score-title')).toBeVisible();
  await page.getByTestId('btn-more').click();
  await page.getByTestId('btn-delete').click();
  await page.getByTestId('confirm-ok').click();
  await expect(page).toHaveURL(/#\/$/);
  const left = await page.evaluate(() => window.__notyTest!.storage.listScores());
  expect(left).toEqual([]);

  watch.expectNoErrors();
});
