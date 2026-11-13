// Renders public/icons/icon.svg to PNG with Playwright Chromium. Run once, commit the PNGs.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'public/icons/icon.svg'), 'utf8').replace(/<\?xml[^>]*>/, '');
const BG = '#F6F1E7';

const browser = await chromium.launch();
async function shot(file, size, padding = 0) {
  const inner = size - 2 * padding;
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const html = `<body style="margin:0;background:${BG};display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px"><div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body>`;
  await page.setContent(html);
  writeFileSync(join(root, 'public/icons', file), await page.screenshot({ omitBackground: false }));
  await page.close();
}
await shot('icon-180.png', 180);
await shot('icon-192.png', 192);
await shot('icon-512.png', 512);
await shot('icon-maskable-512.png', 512, Math.round(512 * 0.1));
await browser.close();
console.log('make-icons: done');
