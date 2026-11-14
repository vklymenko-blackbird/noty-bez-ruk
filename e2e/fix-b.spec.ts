import { test, expect, type Page } from '@playwright/test';
import { openApp, addFixtureScore, watchErrors } from './helpers';

const LONG_90 = 'Імпровізація з дуже довгою назвою, яка займає три рядки і навіть більше, ніж ми очікували';
const MOON = 'Соната для фортепіано № 14 до-дієз мінор «Місячна», ор. 27 № 2: I. Adagio sostenuto';

interface TitleGeometry {
  lines: number;
  maxLines: number;
  wholeLines: boolean;
  insideCover: boolean;
  clearOfFoot: boolean;
  visibleTextEndsInBox: boolean;
}

/** Measures the title box of every generated cover on the page. */
async function measureTitles(page: Page): Promise<TitleGeometry[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-testid="cover"]')).map((cover) => {
      const title = cover.querySelector<HTMLElement>('.cover__title')!;
      const foot = cover.querySelector<HTMLElement>('.cover__foot')!;
      const style = getComputedStyle(title);
      const lh = parseFloat(style.lineHeight);
      const box = title.getBoundingClientRect();
      const frame = cover.getBoundingClientRect();
      const lines = Math.round(box.height / lh);
      const range = document.createRange();
      range.selectNodeContents(title);
      const visible = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.top < box.bottom - 1);
      return {
        lines,
        maxLines: Number(style.getPropertyValue('--lines')),
        wholeLines: Math.abs(box.height - lines * lh) < 1,
        insideCover: box.bottom <= frame.bottom && box.top >= frame.top,
        clearOfFoot: box.bottom <= foot.getBoundingClientRect().top + 1,
        visibleTextEndsInBox: visible.every((r) => r.bottom <= box.bottom + 1),
      };
    }),
  );
}

function expectCleanClamp(geometry: TitleGeometry[]): void {
  expect(geometry.length).toBeGreaterThan(0);
  for (const g of geometry) {
    expect(g.wholeLines).toBe(true);
    expect(g.lines).toBeLessThanOrEqual(g.maxLines);
    expect(g.insideCover).toBe(true);
    expect(g.clearOfFoot).toBe(true);
    expect(g.visibleTextEndsInBox).toBe(true);
  }
}

test('long titles clamp cleanly on the library card and on the score cover', async ({ page }) => {
  const watch = watchErrors(page);
  await openApp(page);
  const moon = await addFixtureScore(page, 'score-12.pdf', MOON, 12, 'Людвіг ван Бетховен');
  await addFixtureScore(page, 'score-3.pdf', LONG_90, 3, 'Петро Чайковський');
  await addFixtureScore(page, 'score-3.pdf', `${LONG_90} ${LONG_90} ${LONG_90}`, 3, 'Автор');
  await page.reload();
  await expect(page.getByTestId('score-card')).toHaveCount(3);
  expectCleanClamp(await measureTitles(page));

  await page.evaluate((id) => window.__notyTest!.navigate('/score/' + id), moon);
  await expect(page.getByTestId('cover')).toBeVisible();
  expectCleanClamp(await measureTitles(page));
  watch.expectNoErrors();
});

test('the continue tag does not cover the surname or the title', async ({ page }) => {
  await openApp(page);
  const id = await addFixtureScore(page, 'score-12.pdf', 'Ноктюрн', 12, 'Фредерик Шопен');
  await page.evaluate((scoreId) => window.__notyTest!.storage.updateScore(scoreId, { lastOpenedAt: Date.now() }), id);
  await page.reload();
  const tag = page.getByTestId('continue-ribbon');
  await expect(tag).toBeVisible();
  const overlap = await page.evaluate(() => {
    const r = (el: Element) => el.getBoundingClientRect();
    const tagBox = r(document.querySelector('[data-testid="continue-ribbon"]')!);
    return ['.cover__surname', '.cover__title', '.cover'].map((sel) => {
      const b = r(document.querySelector(sel)!);
      return !(tagBox.right <= b.left || tagBox.left >= b.right || tagBox.bottom <= b.top || tagBox.top >= b.bottom);
    });
  });
  expect(overlap).toEqual([false, false, false]);
});

for (const [name, size] of [['portrait', { width: 744, height: 1133 }], ['landscape', { width: 1133, height: 744 }]] as const) {
  test(`library action bar is slim, opaque and the last row stays visible (${name})`, async ({ page }) => {
    await page.setViewportSize(size);
    await openApp(page);
    for (let i = 0; i < 9; i += 1) await addFixtureScore(page, 'score-3.pdf', `Твір ${i + 1}`, 3, 'Автор Авторович');
    await page.reload();
    await expect(page.getByTestId('score-card')).toHaveCount(9);
    const bar = page.locator('.library__actions');
    const box = (await bar.boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(100);
    expect(box.y + box.height).toBeGreaterThanOrEqual(size.height - 1);
    const bg = await bar.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toMatch(/rgba\(.*, 0\)|transparent/);
    const buttons = await page.locator('.library__actions button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
    expect(Math.abs(buttons[0] - buttons[1])).toBeLessThan(1);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const last = page.getByTestId('score-card').last();
    await expect.poll(async () => {
      const cardBox = (await last.boundingBox())!;
      const barBox = (await bar.boundingBox())!;
      return cardBox.y + cardBox.height <= barBox.y + 1;
    }).toBe(true);
  });
}
