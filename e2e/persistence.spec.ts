import { test, expect, type Page } from '@playwright/test';
import { fixturePath, getState, openApp, watchErrors } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('noty.coach.v1', '3'));
});

async function reload(page: Page): Promise<void> {
  await page.reload();
  await page.waitForFunction(() => !!window.__notyTest);
}

async function cardId(page: Page, hasText: string): Promise<string> {
  const id = await page.getByTestId('score-card').filter({ hasText }).first().getAttribute('data-id');
  if (!id) throw new Error('no card id for ' + hasText);
  return id;
}

async function currentPage(page: Page): Promise<number> {
  return ((await getState(page)).play as { page: number }).page;
}

test.describe('persistence', () => {
  test.setTimeout(120_000);

  test('imports, progress, notes, rename, delete and settings survive a reload', async ({ page }) => {
    const watch = watchErrors(page);
    await openApp(page, { settings: { gesture: 'off' } });

    await test.step('import three scores', async () => {
      await page.getByTestId('input-file').setInputFiles([fixturePath('score-3.pdf'), fixturePath('score-12.pdf'), fixturePath('landscape-1.pdf')]);
      await expect(page.getByTestId('score-card')).toHaveCount(3);
      await reload(page);
      await expect(page.getByTestId('score-card')).toHaveCount(3);
    });

    const id12 = await cardId(page, 'score-12');

    await test.step('reading progress', async () => {
      await page.evaluate((i) => window.__notyTest!.navigate(`/play/${i}`), id12);
      await expect(page.getByTestId('play-root')).toBeVisible();
      await expect(page.getByTestId('pv-layer').first()).toBeVisible();
      for (let i = 0; i < 4; i++) await page.keyboard.press('PageDown');
      await expect.poll(() => currentPage(page), { timeout: 10_000 }).toBe(5);
      await page.evaluate(() => window.__notyTest!.navigate('/'));
      await expect(page.getByTestId('screen-library')).toBeVisible();
      await reload(page);
      await expect(page.getByText('стор. 5 з 12')).toBeVisible();
      await page.evaluate((i) => window.__notyTest!.navigate(`/play/${i}`), id12);
      await expect(page.getByTestId('play-root')).toBeVisible();
      await expect.poll(() => currentPage(page), { timeout: 10_000 }).toBe(5);
    });

    await test.step('a note on page 1', async () => {
      const id3 = await cardId0(page);
      await page.evaluate(() => window.__notyTest!.navigate('/'));
      await page.evaluate((i) => window.__notyTest!.navigate(`/play/${i}`), id3);
      await expect(page.getByTestId('play-root')).toBeVisible();
      await expect(page.getByTestId('pv-layer').first()).toBeVisible();
      const box = await page.getByTestId('play-root').boundingBox();
      if (!box) throw new Error('no play-root');
      await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.5);
      await page.getByTestId('ctl-annotate').click();
      const layer = page.getByTestId('annot-layer');
      await expect(layer).toBeVisible();
      await page.waitForTimeout(500);
      const l = await layer.boundingBox();
      if (!l) throw new Error('no annot-layer');
      await page.mouse.move(l.x + l.width * 0.2, l.y + l.height * 0.3);
      await page.mouse.down();
      await page.mouse.move(l.x + l.width * 0.6, l.y + l.height * 0.35, { steps: 8 });
      await page.mouse.up();
      await page.getByTestId('annot-done').click();
      await reload(page);
      const count = await page.evaluate(async (i) => (await window.__notyTest!.storage.getMarks(i, 1)).length, id3);
      expect(count).toBe(1);
    });

    await test.step('rename', async () => {
      await page.evaluate(() => window.__notyTest!.navigate('/'));
      const id = await cardId(page, 'landscape-1');
      await page.evaluate((i) => window.__notyTest!.navigate(`/score/${i}`), id);
      await expect(page.getByTestId('screen-score')).toBeVisible();
      await page.getByRole('button', { name: 'Перейменувати' }).first().click();
      const field = page.getByLabel('Назва твору');
      await field.fill('Нова назва');
      await field.press('Enter');
      await reload(page);
      await page.evaluate(() => window.__notyTest!.navigate('/'));
      await expect(page.getByTestId('score-card').filter({ hasText: 'Нова назва' })).toHaveCount(1);
    });

    await test.step('delete', async () => {
      const id = await cardId(page, 'Нова назва');
      await page.evaluate((i) => window.__notyTest!.navigate(`/score/${i}`), id);
      await page.getByRole('button', { name: 'Видалити твір' }).first().click();
      await page.getByTestId('confirm-ok').click();
      await expect(page.getByTestId('screen-library')).toBeVisible();
      await reload(page);
      await expect(page.getByTestId('score-card')).toHaveCount(2);
    });

    await test.step('settings', async () => {
      await page.evaluate(() => window.__notyTest!.navigate('/settings'));
      await page.getByTestId('set-gesture-mouth').click();
      await page.getByTestId('set-theme-dark').click();
      await reload(page);
      await expect(page.getByTestId('set-gesture-mouth')).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    });

    watch.expectNoErrors();
  });

  test('corrupt and non-PDF files show errors and add nothing', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('input-file').setInputFiles([fixturePath('corrupt.pdf')]);
    await expect(page.getByText('Не вдалося відкрити PDF: corrupt.pdf')).toBeVisible();
    await page.getByTestId('input-file').setInputFiles([fixturePath('not-a-pdf.pdf')]);
    await expect(page.getByText('Це не PDF-файл: not-a-pdf.pdf')).toBeVisible();
    await expect(page.getByTestId('score-card')).toHaveCount(0);
    const n = await page.evaluate(async () => (await window.__notyTest!.storage.listScores()).length);
    expect(n).toBe(0);
  });
});

async function cardId0(page: Page): Promise<string> {
  await page.evaluate(() => window.__notyTest!.navigate('/'));
  return cardId(page, 'score-3');
}
