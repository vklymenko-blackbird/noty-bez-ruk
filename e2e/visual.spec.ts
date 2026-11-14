import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { addFixtureScore, openApp } from './helpers';

// Screenshots of every screen in both themes, for the polish packages to review.
// Files go to test-results/shots/<theme>-<name>.png. This spec writes no app code and checks no layout rules
// except two: the file was written, and the page has no horizontal overflow (play mode is exempt).

const SHOTS = resolve(process.cwd(), 'test-results/shots');
const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];
const PAPERS = ['ivory', 'sepia', 'night', 'contrast', 'plain'] as const;

const LONG_TITLE = 'Соната для фортепіано та віолончелі до мажор, опус 102, номер 1, у двох частинах з вступом і кодою';

async function shot(page: Page, theme: Theme, name: string, opts: { overflow?: boolean } = {}): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const path = resolve(SHOTS, `${theme}-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  expect(existsSync(path), `${theme}-${name}.png was written`).toBe(true);
  if (opts.overflow !== false) {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `${theme}-${name}: horizontal overflow in pixels`).toBeLessThanOrEqual(0);
  }
}

test.beforeEach(async ({ page }) => {
  // The coach layer is hidden by default. The coach shot clears this key itself.
  await page.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('noty.visual.coach')) localStorage.setItem('noty.coach.v1', '3');
    } catch {
      /* ignore */
    }
  });
});

async function addFiveScores(page: Page): Promise<string[]> {
  const ids: string[] = [];
  ids.push(await addFixtureScore(page, 'score-12.pdf', 'Місячна соната', 12, 'Людвіг ван Бетховен'));
  ids.push(await addFixtureScore(page, 'score-3.pdf', 'Ноктюрн мі-бемоль мажор', 3, 'Фридерик Шопен'));
  ids.push(await addFixtureScore(page, 'score-3.pdf', 'До Елізи', 3, 'Людвіг ван Бетховен'));
  ids.push(await addFixtureScore(page, 'score-12.pdf', LONG_TITLE, 12, 'Людвіг ван Бетховен'));
  ids.push(await addFixtureScore(page, 'margins-2.pdf', 'Етюд без автора', 2));
  return ids;
}

async function openPlay(page: Page, id: string): Promise<void> {
  await page.evaluate((i) => window.__notyTest!.navigate(`/play/${i}`), id);
  await expect(page.getByTestId('play-root')).toBeVisible();
  await expect(page.getByTestId('pv-layer').first()).toBeVisible();
  // Let the page image settle.
  await page.waitForTimeout(600);
}

async function mockSearch(page: Page): Promise<void> {
  await page.route('https://commons.wikimedia.org/w/api.php**', (route) => {
    const mk = (id: number, title: string, size: number, pages: number) => ({
      pageid: id,
      index: id,
      title: `File:${title}.pdf`,
      imageinfo: [
        {
          mime: 'application/pdf',
          size,
          pagecount: pages,
          url: `https://upload.wikimedia.org/wikipedia/commons/a/a${id}/${encodeURIComponent(title)}.pdf`,
          descriptionurl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title)}.pdf`,
          extmetadata: { LicenseShortName: { value: 'Public domain' } },
        },
      ],
    });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        query: {
          pages: {
            '1': mk(1, 'IMSLP00001-Beethoven, Ludwig van - Fur Elise', 180_000, 4),
            '2': mk(2, 'Chopin Nocturne Op 9 No 2', 320_000, 5),
            '3': mk(3, 'Clair de lune - Debussy', 540_000, 8),
          },
        },
      }),
    });
  });
  await page.route('https://upload.wikimedia.org/**', (route) => route.fulfill({ status: 404, body: '' }));
}

for (const theme of THEMES) {
  test.describe(`visual: ${theme}`, () => {
    test(`${theme}: onboarding steps`, async ({ page }) => {
      await openApp(page, { onboarded: false, settings: { appTheme: theme } });
      await expect(page.getByTestId('onb-install-first')).toBeVisible();
      await shot(page, theme, 'onboarding-install');
      await page.getByTestId('onb-continue-safari').click();
      for (let i = 1; i <= 3; i++) {
        await expect(page.getByTestId('onb-next').or(page.getByTestId('onb-install'))).toBeVisible();
        await shot(page, theme, `onboarding-card-${i}`);
        if (i < 3) await page.getByTestId('onb-next').click();
      }
    });

    test(`${theme}: library empty and full`, async ({ page }) => {
      await openApp(page, { settings: { appTheme: theme } });
      await expect(page.getByTestId('library-empty')).toBeVisible();
      await shot(page, theme, 'library-empty');
      await addFiveScores(page);
      await page.evaluate(() => window.__notyTest!.navigate('/settings'));
      await page.evaluate(() => window.__notyTest!.navigate('/'));
      await expect(page.getByTestId('score-card')).toHaveCount(5);
      await page.waitForTimeout(500);
      await shot(page, theme, 'library-five');
    });

    test(`${theme}: search`, async ({ page }) => {
      await mockSearch(page);
      await openApp(page, { settings: { appTheme: theme }, path: '/search' });
      await expect(page.getByTestId('screen-search')).toBeVisible();
      await page.waitForTimeout(400);
      await shot(page, theme, 'search-popular');
      const input = page.locator('input').first();
      if ((await input.count()) > 0) {
        await input.fill('Для Елізи');
        await input.press('Enter');
        await page.waitForTimeout(1200);
      }
      await shot(page, theme, 'search-results');
    });

    test(`${theme}: score detail`, async ({ page }) => {
      await openApp(page, { settings: { appTheme: theme } });
      const id = await addFixtureScore(page, 'score-12.pdf', 'Місячна соната', 12, 'Людвіг ван Бетховен');
      await page.evaluate((i) => window.__notyTest!.navigate(`/score/${i}`), id);
      await expect(page.getByTestId('screen-score')).toBeVisible();
      await page.waitForTimeout(600);
      await shot(page, theme, 'score-detail');
    });

    test(`${theme}: play with each paper theme`, async ({ page }) => {
      await openApp(page, { settings: { appTheme: theme, gesture: 'off', halfPage: false } });
      const id = await addFixtureScore(page, 'score-12.pdf', 'Місячна соната', 12, 'Людвіг ван Бетховен');
      await openPlay(page, id);
      for (const paper of PAPERS) {
        await page.evaluate(async ([i, p]) => window.__notyTest!.storage.updateScore(i, { paper: p as never }), [id, paper]);
        await page.evaluate((i) => window.__notyTest!.navigate(`/score/${i}`), id);
        await openPlay(page, id);
        await expect(page.locator(`[data-testid="pv-layer"].paper-${paper}`).first()).toBeVisible();
        await shot(page, theme, `play-paper-${paper}`, { overflow: false });
      }
    });

    test(`${theme}: play half page and controls sheet`, async ({ page }) => {
      await openApp(page, { settings: { appTheme: theme, gesture: 'off', halfPage: true } });
      const id = await addFixtureScore(page, 'score-12.pdf', 'Місячна соната', 12, 'Людвіг ван Бетховен');
      await openPlay(page, id);
      await page.keyboard.press('PageDown');
      await expect(page.getByTestId('pv-divider')).toBeVisible();
      await page.waitForTimeout(700);
      await shot(page, theme, 'play-half', { overflow: false });

      const box = await page.getByTestId('play-root').boundingBox();
      if (!box) throw new Error('no play-root');
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6);
      await expect(page.getByTestId('controls-sheet')).toBeVisible();
      await page.waitForTimeout(500);
      await shot(page, theme, 'play-controls', { overflow: false });
    });

    test(`${theme}: note mode`, async ({ page }) => {
      await openApp(page, { settings: { appTheme: theme, gesture: 'off', halfPage: false } });
      const id = await addFixtureScore(page, 'score-3.pdf', 'До Елізи', 3, 'Людвіг ван Бетховен');
      await openPlay(page, id);
      const box = await page.getByTestId('play-root').boundingBox();
      if (!box) throw new Error('no play-root');
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6);
      await expect(page.getByTestId('controls-sheet')).toBeVisible();
      await page.getByTestId('ctl-annotate').click();
      await expect(page.getByTestId('annot-toolbar')).toBeVisible();
      await expect(page.getByTestId('annot-layer')).toBeVisible();
      await page.waitForTimeout(600);
      const layer = await page.getByTestId('annot-layer').boundingBox();
      if (!layer) throw new Error('no annot-layer');
      const pt = (fx: number, fy: number) => ({ x: layer.x + layer.width * fx, y: layer.y + layer.height * fy });
      const drag = async (a: [number, number], b: [number, number]) => {
        const p = pt(...a);
        const q = pt(...b);
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
        await page.mouse.move(q.x, q.y, { steps: 8 });
        await page.mouse.up();
      };
      await drag([0.2, 0.3], [0.7, 0.33]);
      await drag([0.25, 0.5], [0.6, 0.45]);
      await page.getByTestId('tool-stamp-3').click();
      const s = pt(0.5, 0.7);
      await page.mouse.click(s.x, s.y);
      await page.waitForTimeout(300);
      await shot(page, theme, 'play-notes', { overflow: false });
    });

    test(`${theme}: coach layer`, async ({ page }) => {
      await page.addInitScript(() => {
        try {
          sessionStorage.setItem('noty.visual.coach', '1');
          localStorage.removeItem('noty.coach.v1');
        } catch {
          /* ignore */
        }
      });
      await openApp(page, { settings: { appTheme: theme, gesture: 'off', halfPage: false } });
      const id = await addFixtureScore(page, 'score-3.pdf', 'До Елізи', 3, 'Людвіг ван Бетховен');
      await page.evaluate((i) => window.__notyTest!.navigate(`/play/${i}`), id);
      await expect(page.getByTestId('play-root')).toBeVisible();
      await expect(page.getByTestId('play-coach')).toBeVisible({ timeout: 10_000 });
      await shot(page, theme, 'play-coach', { overflow: false });
    });

    test(`${theme}: camera banner`, async ({ page }) => {
      await page.addInitScript(() => {
        const reject = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
        if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = reject;
      });
      await openApp(page, { settings: { appTheme: theme, halfPage: false }, query: 'camera=1' });
      const id = await addFixtureScore(page, 'score-3.pdf', 'До Елізи', 3, 'Людвіг ван Бетховен');
      await page.evaluate((i) => window.__notyTest!.navigate(`/play/${i}`), id);
      await expect(page.getByTestId('play-root')).toBeVisible();
      await expect(page.getByTestId('play-camera-banner')).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(500);
      await shot(page, theme, 'play-camera-banner', { overflow: false });
    });

    test(`${theme}: calibration overlay`, async ({ page }) => {
      await openApp(page, { settings: { appTheme: theme }, path: '/dev/gesture' });
      await expect(page.getByTestId('calib-overlay')).toBeVisible();
      await page.waitForTimeout(400);
      await shot(page, theme, 'calibration');
    });

    test(`${theme}: settings top and bottom`, async ({ page }) => {
      await openApp(page, { settings: { appTheme: theme }, path: '/settings' });
      await expect(page.getByTestId('screen-settings')).toBeVisible();
      await page.waitForTimeout(300);
      // Top and bottom of the scrolled view (not a full-page capture).
      const top = resolve(SHOTS, `${theme}-settings-top.png`);
      await page.screenshot({ path: top });
      expect(existsSync(top)).toBe(true);
      await page.getByTestId('set-group-about').scrollIntoViewIfNeeded();
      await page.evaluate(() => {
        const els = [document.scrollingElement, ...Array.from(document.querySelectorAll<HTMLElement>('*'))];
        for (const el of els) if (el && el.scrollHeight > el.clientHeight + 4) el.scrollTop = el.scrollHeight;
      });
      await page.waitForTimeout(300);
      const bottom = resolve(SHOTS, `${theme}-settings-bottom.png`);
      await page.screenshot({ path: bottom });
      expect(existsSync(bottom)).toBe(true);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, 'settings: horizontal overflow in pixels').toBeLessThanOrEqual(0);
    });

    test(`${theme}: landscape library and play`, async ({ page }) => {
      await page.setViewportSize({ width: 1133, height: 744 });
      await openApp(page, { settings: { appTheme: theme, gesture: 'off', halfPage: false } });
      const ids = await addFiveScores(page);
      await page.evaluate(() => window.__notyTest!.navigate('/settings'));
      await page.evaluate(() => window.__notyTest!.navigate('/'));
      await expect(page.getByTestId('score-card')).toHaveCount(5);
      await page.waitForTimeout(500);
      await shot(page, theme, 'library-landscape');
      await openPlay(page, ids[0]);
      await shot(page, theme, 'play-landscape', { overflow: false });
    });
  });
}
