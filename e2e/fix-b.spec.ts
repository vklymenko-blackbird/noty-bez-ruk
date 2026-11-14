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

const CORS = { 'access-control-allow-origin': '*' };
/** The catalogue file URL of Für Elise (no query string). */
const ELISE_URL = 'https://upload.wikimedia.org/wikipedia/commons/a/a1/IMSLP11471-Fur_Elise%2C_Beethoven%2C_WoO59.pdf';

test('search: the same file from the catalogue and live Commons shows once, with utm in the live URL', async ({ page }) => {
  const watch = watchErrors(page);
  const fileUrl = ELISE_URL;
  const body = {
    query: {
      pages: {
        '7': {
          pageid: 7,
          index: 1,
          title: 'File:Live_Duplicate.pdf',
          imageinfo: [
            {
              mime: 'application/pdf',
              size: 417000,
              pagecount: 4,
              url: `${fileUrl}?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original`,
              descriptionurl: 'https://commons.wikimedia.org/wiki/File:Live_Duplicate.pdf',
              extmetadata: { LicenseShortName: { value: 'Public domain' } },
            },
          ],
        },
      },
    },
  };
  await page.route('https://commons.wikimedia.org/w/api.php**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) }),
  );
  await openApp(page, { path: '/search' });
  await page.getByTestId('search-input').fill('Elise');
  await expect(page.locator('[data-testid="hit-card"][data-source="catalog"]').first()).toBeVisible();
  await expect(page.getByTestId('search-loading')).toHaveCount(0);
  await expect(page.locator('[data-testid="hit-card"][data-source="commons"]')).toHaveCount(0);
  await expect(page.getByText('Live Duplicate')).toHaveCount(0);
  watch.expectNoErrors();
});

const DOWNLOAD_CASES = [
  { name: 'HTTP 404', status: 404, body: 'gone', text: 'Не вдалося завантажити. Перевірте інтернет.' },
  { name: 'HTTP 503', status: 503, body: 'down', text: 'Не вдалося завантажити. Перевірте інтернет.' },
  { name: 'HTTP 429', status: 429, body: 'slow down', text: 'Wikimedia тимчасово обмежила завантаження. Спробуйте за кілька хвилин.' },
  { name: 'HTTP 200 with a body that is not a PDF', status: 200, body: '<html>nope</html>', text: 'Джерело повернуло не PDF' },
] as const;

for (const c of DOWNLOAD_CASES) {
  test(`search: download error for ${c.name} shows the right message and a source link`, async ({ page }) => {
    const watch = watchErrors(page, { ignore: [/Failed to load resource/] });
    await page.route('https://commons.wikimedia.org/w/api.php**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ query: { pages: {} } }) }),
    );
    await page.route('https://upload.wikimedia.org/**', (route) =>
      route.fulfill({ status: c.status, contentType: 'text/html', headers: CORS, body: c.body }),
    );
    await openApp(page, { path: '/search' });
    await page.getByTestId('search-input').fill('Elise');
    const card = page.locator('[data-testid="hit-card"][data-source="catalog"]').first();
    await card.getByTestId('hit-add').click();
    await expect(page.getByText(c.text)).toBeVisible();
    await expect(card.locator('.hit__source--strong')).toBeVisible();
    expect(await page.evaluate(() => window.__notyTest!.storage.listScores())).toHaveLength(0);
    watch.expectNoErrors();
  });
}

test('touch targets: sort buttons, segmented controls and the source link are at least 48 px high', async ({ page }) => {
  const watch = watchErrors(page);
  await page.route('https://commons.wikimedia.org/w/api.php**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ query: { pages: {} } }) }),
  );
  await openApp(page);
  await addFixtureScore(page, 'score-3.pdf', 'Перший', 3, 'Автор');
  await addFixtureScore(page, 'score-3.pdf', 'Другий', 3, 'Автор');
  await page.reload();
  const heights = async (selector: string) => page.locator(selector).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height * 10) / 10));

  expect(await heights('.library__sort .ui-segmented__item')).toHaveLength(3);
  for (const h of await heights('.library__sort .ui-segmented__item')) expect(h).toBeGreaterThanOrEqual(48);

  await page.evaluate(() => window.__notyTest!.navigate('/settings'));
  await expect(page.getByTestId('set-gesture-head')).toBeVisible();
  for (const h of await heights('.ui-segmented__item')) expect(h).toBeGreaterThanOrEqual(48);

  await page.evaluate(() => window.__notyTest!.navigate('/search'));
  await page.getByTestId('search-input').fill('Elise');
  await expect(page.locator('.hit__source').first()).toBeVisible();
  for (const h of await heights('.hit__source')) expect(h).toBeGreaterThanOrEqual(48);
  watch.expectNoErrors();
});

test('settings: pedal keys show friendly names and sizes use ГБ', async ({ page }) => {
  await openApp(page, { path: '/settings' });
  const chips = page.locator('.set-pedal-row__chips .ui-chip');
  await expect(chips.first()).toBeVisible();
  const texts = await chips.allTextContents();
  expect(texts.join('|')).not.toMatch(/Arrow/);
  expect(texts).toEqual(expect.arrayContaining(['→ Стрілка вправо', '← Стрілка вліво', 'Page Down', 'Пробіл', 'Enter', 'Backspace']));
  await expect(page.getByTestId('screen-settings')).not.toContainText('МБ з 5');
});

test('rename sheet shows visible labels above the fields', async ({ page }) => {
  await openApp(page);
  const id = await addFixtureScore(page, 'score-3.pdf', 'Ноктюрн', 3, 'Шопен');
  await page.evaluate((scoreId) => window.__notyTest!.navigate('/score/' + scoreId), id);
  await page.getByTestId('btn-more').click();
  await page.getByTestId('btn-rename').click();
  const sheet = page.getByTestId('rename-sheet');
  for (const label of ['Назва твору', 'Композитор']) {
    const el = sheet.locator('.ui-label', { hasText: label });
    await expect(el).toBeVisible();
    expect((await el.boundingBox())!.height).toBeGreaterThan(8);
  }
});

test('paper swatches have a visible ring and a colour under the production CSP', async ({ page }) => {
  const watch = watchErrors(page);
  await openApp(page, { settings: { appTheme: 'dark' } });
  const id = await addFixtureScore(page, 'score-3.pdf', 'Ноктюрн', 3, 'Шопен');
  await page.evaluate((scoreId) => window.__notyTest!.navigate('/score/' + scoreId), id);
  const swatch = page.getByTestId('paper-chip-night').locator('.ui-chip__swatch');
  await expect(swatch).toBeVisible();
  const style = await swatch.evaluate((el) => {
    const s = getComputedStyle(el);
    return { ring: s.borderTopColor, width: s.borderTopWidth, bg: s.backgroundColor, inline: el.getAttribute('style') };
  });
  expect(style.inline).toBeNull();
  expect(style.width).toBe('1px');
  expect(style.ring).not.toBe(style.bg);
  expect(style.bg).not.toMatch(/rgba\(0, 0, 0, 0\)/);
  watch.expectNoErrors();
});

test('install advice shows once: one paragraph in the install step, none repeated on card 3', async ({ page }) => {
  await openApp(page, { onboarded: false });
  const step = page.getByTestId('onb-install-first');
  await expect(step).toBeVisible();
  await expect(step.locator('p.onb-body')).toHaveCount(1);
  await page.getByTestId('onb-continue-safari').click();
  await page.getByTestId('onb-next').click();
  await page.getByTestId('onb-next').click();
  await expect(page.getByTestId('onb-start')).toBeVisible();
  await expect(page.getByText('Початковий екран')).toHaveCount(0);
});
