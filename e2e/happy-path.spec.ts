import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fixturePath, getState, openApp, replayTrace, watchErrors } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('noty.coach.v1', '3'));
});

test('the whole journey: onboarding, find, add, play, leave, continue', async ({ page }) => {
  test.setTimeout(120_000);
  const watch = watchErrors(page);
  const pdf = readFileSync(fixturePath('score-3.pdf'));

  await page.route('https://commons.wikimedia.org/w/api.php**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ batchcomplete: '' }),
    }),
  );
  await page.route('https://upload.wikimedia.org/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      headers: { 'access-control-allow-origin': '*' },
      body: pdf,
    }),
  );

  await test.step('onboarding', async () => {
    await openApp(page, { onboarded: false });
    await expect(page.getByTestId('onb-install-first')).toBeVisible();
    await page.getByTestId('onb-continue-safari').click();
    await page.getByTestId('onb-next').click();
    await page.getByTestId('onb-next').click();
    await page.getByTestId('onb-start').click();
    await expect(page.getByTestId('screen-library')).toBeVisible();
    await expect(page.getByTestId('library-empty')).toBeVisible();
  });

  await test.step('find and add the score', async () => {
    await page.getByRole('button', { name: 'Знайти ноти' }).first().click();
    await expect(page.getByTestId('screen-search')).toBeVisible();
    await page.getByPlaceholder('Назва твору або композитор').fill('до елізи');
    const add = page.getByRole('button', { name: 'Додати' }).first();
    await expect(add).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Ліцензія:/).first()).toBeVisible();
    await add.click();
    const open = page.getByRole('button', { name: 'Відкрити', exact: true }).first();
    await expect(open).toBeVisible({ timeout: 30_000 });
    await open.click();
  });

  await test.step('score screen', async () => {
    await expect(page.getByTestId('screen-score')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'До Елізи', level: 2 })).toBeVisible();
    await page.getByRole('button', { name: 'Грати' }).first().click();
  });

  await test.step('play two turns by head and leave', async () => {
    await expect(page.getByTestId('play-root')).toBeVisible();
    await expect(page.getByTestId('calib-overlay')).toBeVisible();
    await replayTrace(page, 'turn-right-hold');
    await replayTrace(page, 'turn-right-hold');
    await expect.poll(async () => ((await getState(page)).play as { page: number }).page, { timeout: 10_000 }).toBe(2);
    const box = await page.getByTestId('play-root').boundingBox();
    if (!box) throw new Error('no play-root');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.5);
    await expect(page.getByTestId('controls-sheet')).toBeVisible();
    await page.getByRole('button', { name: 'Вийти' }).first().click();
  });

  await test.step('library shows the progress', async () => {
    await page.evaluate(() => window.__notyTest!.navigate('/'));
    await expect(page.getByTestId('screen-library')).toBeVisible();
    await expect(page.getByTestId('score-card')).toHaveCount(1);
    await expect(page.getByTestId('continue-ribbon')).toHaveText('Продовжити');
    await expect(page.getByText('стор. 2 з 3')).toBeVisible();
  });

  watch.expectNoErrors();
});
