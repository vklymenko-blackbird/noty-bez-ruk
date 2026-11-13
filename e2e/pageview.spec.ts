import { test, expect, type Page } from '@playwright/test';
import { addFixtureScore, openApp, watchErrors } from './helpers';

async function openHarness(page: Page, fixture = 'score-12.pdf', pages = 12): Promise<void> {
  await openApp(page);
  const id = await addFixtureScore(page, fixture, 'PV', pages);
  await page.evaluate((p) => window.__notyTest!.navigate(p), `/dev/pageview/${id}`);
  await expect(page.getByTestId('dev-pageview')).toBeVisible();
}

const base = (page: Page) => page.locator('[data-testid="pv-layer"][data-role="base"]');

test('base layer shows with a canvas', async ({ page }) => {
  const watch = watchErrors(page);
  await openHarness(page);
  await expect(base(page)).toHaveAttribute('data-page', '1');
  const w = await base(page).locator('canvas').first().evaluate((c) => (c as HTMLCanvasElement).width);
  expect(w).toBeGreaterThan(0);
  watch.expectNoErrors();
});

test('half page turn, divider, prev, paper', async ({ page }) => {
  const watch = watchErrors(page);
  await openHarness(page);
  await expect(base(page)).toHaveAttribute('data-page', '1');
  await page.getByTestId('dev-next').click();
  await expect(page.getByTestId('dev-pos')).toHaveText('1:true');
  await expect(page.locator('[data-testid="pv-layer"][data-role="top"]')).toHaveAttribute('data-page', '2');
  await expect(page.getByTestId('pv-divider')).toBeVisible();
  await page.getByTestId('dev-next').click();
  await expect(page.getByTestId('dev-pos')).toHaveText('2:false');
  await expect(page.getByTestId('pv-layer')).toHaveCount(1);
  await expect(page.getByTestId('pv-layer')).toHaveAttribute('data-page', '2');
  await expect(page.getByTestId('pv-divider')).toHaveCount(0);
  await page.getByTestId('dev-prev').click();
  await expect(page.getByTestId('dev-pos')).toHaveText('1:false');
  await page.getByTestId('dev-paper-night').click();
  await expect(page.getByTestId('pv-layer').first()).toHaveClass(/paper-night/);
  watch.expectNoErrors();
});

test('canvas count stays small after many turns', async ({ page }) => {
  const watch = watchErrors(page);
  await openHarness(page);
  await expect(base(page)).toHaveAttribute('data-page', '1');
  for (let i = 0; i < 8; i++) await page.getByTestId('dev-next').click();
  await expect(page.getByTestId('dev-pos')).toHaveText('5:false');
  await expect(base(page)).toHaveAttribute('data-page', '5');
  const alive = await page
    .getByTestId('pv')
    .locator('canvas')
    .evaluateAll((cs) => cs.filter((c) => (c as HTMLCanvasElement).width > 0).length);
  expect(alive).toBeLessThanOrEqual(4);
  watch.expectNoErrors();
});

test('crop changes the box aspect', async ({ page }) => {
  const watch = watchErrors(page);
  await openHarness(page, 'margins-2.pdf', 2);
  const aspect = async () => {
    const b = await base(page).boundingBox();
    return b ? b.width / b.height : 0;
  };
  await expect(base(page)).toBeVisible();
  const first = await aspect();
  await page.getByTestId('dev-crop').click();
  await expect.poll(aspect).not.toBeCloseTo(first, 2);
  watch.expectNoErrors();
});

test('divider drag changes the clip', async ({ page }) => {
  const watch = watchErrors(page);
  await openHarness(page);
  await expect(base(page)).toHaveAttribute('data-page', '1');
  await page.getByTestId('dev-next').click();
  const top = page.locator('[data-testid="pv-layer"][data-role="top"]');
  await expect(page.getByTestId('pv-divider')).toBeVisible();
  const before = await top.evaluate((el) => (el as HTMLElement).style.clipPath);
  const notch = await page.getByTestId('pv-notch').boundingBox();
  expect(notch).not.toBeNull();
  const x = notch!.x + notch!.width / 2;
  const y = notch!.y + notch!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 50, { steps: 5 });
  await page.mouse.move(x, y + 100, { steps: 5 });
  await page.mouse.up();
  const after = await top.evaluate((el) => (el as HTMLElement).style.clipPath);
  expect(after).not.toBe(before);
  watch.expectNoErrors();
});
