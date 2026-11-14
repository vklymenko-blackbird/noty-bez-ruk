import { test, expect } from '@playwright/test';
import { fixturePath, getState, openApp, watchErrors } from './helpers';

test.describe('webkit smoke', () => {
  test('the library renders @webkit', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { settings: { gesture: 'off' } });
    await expect(page.getByTestId('screen-library')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Мої ноти' })).toBeVisible();
    watch.expectNoErrors();
  });

  test('a fixture import, the score screen and play mode work @webkit', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { settings: { gesture: 'off' } });
    await page.addInitScript(() => localStorage.setItem('noty.coach.v1', '3'));
    await page.getByTestId('input-file').setInputFiles([fixturePath('score-3.pdf')]);
    const card = page.getByTestId('score-card');
    await expect(card).toHaveCount(1);
    const id = await card.getAttribute('data-id');
    await card.click();
    await expect(page.getByTestId('screen-score')).toBeVisible();
    await expect(page.getByTestId('screen-score').locator('canvas').first()).toBeVisible({ timeout: 15_000 });

    await page.evaluate((i) => window.__notyTest!.navigate(`/play/${i}`), id);
    await expect(page.getByTestId('play-root')).toBeVisible();
    const canvas = page.getByTestId('pv-layer').first().locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const width = await canvas.evaluate((c) => (c as HTMLCanvasElement).width);
    expect(width).toBeGreaterThan(0);

    const box = await page.getByTestId('play-root').boundingBox();
    if (!box) throw new Error('no play-root');
    await page.mouse.click(box.x + box.width * 0.9, box.y + box.height * 0.6);
    await expect.poll(async () => ((await getState(page)).play as { page: number }).page, { timeout: 10_000 }).toBe(2);
    watch.expectNoErrors();
  });

  test('settings render and the dark theme applies @webkit', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { path: '/settings', settings: { gesture: 'off' } });
    await expect(page.getByTestId('screen-settings')).toBeVisible();
    await page.getByTestId('set-theme-dark').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    watch.expectNoErrors();
  });
});
