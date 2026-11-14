import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openApp, fixturePath, watchErrors } from './helpers';

const CORS = { 'access-control-allow-origin': '*' };

const COMMONS_BODY = {
  query: {
    pages: {
      '101': {
        pageid: 101,
        index: 1,
        title: 'File:Test_Etude_Op_99.pdf',
        imageinfo: [
          {
            mime: 'application/pdf',
            size: 20000,
            pagecount: 3,
            url: 'https://upload.wikimedia.org/wikipedia/commons/t/t1/Test_Etude_Op_99.pdf',
            descriptionurl: 'https://commons.wikimedia.org/wiki/File:Test_Etude_Op_99.pdf',
            extmetadata: { LicenseShortName: { value: 'Public domain' } },
          },
        ],
      },
    },
  },
};

async function mockNetwork(page: Page): Promise<void> {
  const pdf = readFileSync(fixturePath('score-3.pdf'));
  await page.route('https://commons.wikimedia.org/w/api.php**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(COMMONS_BODY) }),
  );
  await page.route('https://upload.wikimedia.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/pdf', headers: CORS, body: pdf }),
  );
}

test('search: find a catalogue piece, add it and open it', async ({ page }) => {
  const watch = watchErrors(page);
  await mockNetwork(page);
  await openApp(page, { path: '/search' });
  await expect(page.getByTestId('screen-search')).toBeVisible();
  await expect(page.getByTestId('search-note')).toBeVisible();

  await page.getByTestId('search-input').fill('Elise');
  const card = page.locator('[data-testid="hit-card"][data-source="catalog"]').first();
  await expect(card).toBeVisible();
  await expect(card.getByTestId('hit-license')).toContainText('Public domain');

  // The Commons hit shows up after the debounce.
  await expect(page.getByText('Test Etude Op 99')).toBeVisible();

  await card.getByTestId('hit-add').click();
  await expect(card.getByTestId('hit-add')).toHaveText('Відкрити');

  const list = await page.evaluate(() => window.__notyTest!.storage.listScores());
  expect(list).toHaveLength(1);
  expect(list[0]!.origin.kind).toBe('catalog');
  expect((list[0]!.origin.license ?? '').length).toBeGreaterThan(0);
  expect(new URL(list[0]!.origin.pageUrl ?? 'about:blank').hostname).toBe('commons.wikimedia.org');

  await card.getByTestId('hit-add').click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toMatch(/^#\/score\//);
  watch.expectNoErrors();
});

test('search: offline shows the message and keeps the catalogue', async ({ page, context }) => {
  const watch = watchErrors(page, { ignore: [/Failed to load resource/, /net::ERR/] });
  await mockNetwork(page);
  await openApp(page, { path: '/search' });
  await context.setOffline(true);
  await page.getByTestId('search-input').fill('Elise');
  await expect(page.getByTestId('search-offline')).toBeVisible();
  await expect(page.getByTestId('section-catalog')).toBeVisible();
  watch.expectNoErrors();
});

test('search: link-outs go to IMSLP and Commons', async ({ page }) => {
  const watch = watchErrors(page);
  await mockNetwork(page);
  await openApp(page, { path: '/search' });
  await page.getByTestId('search-input').fill('Chopin nocturne');
  const imslp = page.getByTestId('linkout-imslp');
  const commons = page.getByTestId('linkout-commons');
  expect(new URL((await imslp.getAttribute('href')) ?? '').hostname).toBe('imslp.org');
  expect(new URL((await commons.getAttribute('href')) ?? '').hostname).toBe('commons.wikimedia.org');
  await expect(imslp).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(commons).toHaveAttribute('target', '_blank');
  watch.expectNoErrors();
});
