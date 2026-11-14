// Generates the PDF fixtures with pdf-lib. Deterministic. Each file is under 50 KB.
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'tests/fixtures');
mkdirSync(out, { recursive: true });
const FIXED = new Date('2026-01-01T00:00:00Z');

async function newDoc() {
  const doc = await PDFDocument.create();
  doc.setCreationDate(FIXED);
  doc.setModificationDate(FIXED);
  doc.setProducer('noty-bez-ruk fixtures');
  doc.setCreator('noty-bez-ruk fixtures');
  return doc;
}

function stave(page, x0, x1, yTop, gap = 7) {
  for (let i = 0; i < 5; i++) {
    const y = yTop - i * gap;
    page.drawLine({ start: { x: x0, y }, end: { x: x1, y }, thickness: 0.8, color: rgb(0, 0, 0) });
  }
}
function notes(page, x0, yTop, count, seed) {
  for (let i = 0; i < count; i++) {
    const x = x0 + 30 + i * 38;
    const y = yTop - ((i * 3 + seed) % 9) * 3.5;
    page.drawEllipse({ x, y, xScale: 5, yScale: 3.6, rotate: degrees(20), color: rgb(0, 0, 0) });
    page.drawLine({ start: { x: x + 4.5, y }, end: { x: x + 4.5, y: y + 24 }, thickness: 0.8, color: rgb(0, 0, 0) });
  }
}

/** Page number large at the top centre. The top half and the bottom half differ clearly. */
async function scoreDoc(pages) {
  const doc = await newDoc();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let n = 1; n <= pages; n++) {
    const page = doc.addPage([595, 842]);
    const label = String(n);
    const size = 72;
    page.drawText(label, { x: 297.5 - font.widthOfTextAtSize(label, size) / 2, y: 760, size, font, color: rgb(0, 0, 0) });
    // top half: staves with filled blocks, bottom half: staves with notes only
    for (let s = 0; s < 3; s++) {
      stave(page, 60, 535, 680 - s * 70);
      notes(page, 60, 672 - s * 70, 11, n + s);
    }
    page.drawRectangle({ x: 60, y: 450, width: 475, height: 12, color: rgb(0, 0, 0) });
    for (let s = 0; s < 3; s++) {
      stave(page, 60, 535, 380 - s * 70);
      notes(page, 60, 372 - s * 70, 6, n * 2 + s);
    }
    page.drawText(`B${n}`, { x: 280, y: 90, size: 40, font, color: rgb(0.4, 0.4, 0.4) });
  }
  return doc;
}

async function save(name, doc) {
  const bytes = await doc.save({ useObjectStreams: false });
  if (bytes.length > 50_000) throw new Error(`${name} is too large: ${bytes.length}`);
  writeFileSync(join(out, name), bytes);
  console.log(`fixtures: ${name} ${bytes.length} bytes`);
  return bytes;
}

const s3 = await save('score-3.pdf', await scoreDoc(3));
await save('score-12.pdf', await scoreDoc(12));

// margins-2: content only inside the central 60% x 70% of the page, plus a 2 pt speck near a corner.
{
  const doc = await newDoc();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let n = 1; n <= 2; n++) {
    const page = doc.addPage([595, 842]);
    const x0 = 595 * 0.2, x1 = 595 * 0.8, yTop = 842 * 0.85;
    page.drawText(String(n), { x: 280, y: yTop - 40, size: 48, font, color: rgb(0, 0, 0) });
    for (let s = 0; s < 5; s++) {
      stave(page, x0, x1, yTop - 100 - s * 90);
      notes(page, x0, yTop - 108 - s * 90, 8, n + s);
    }
    page.drawRectangle({ x: 20, y: 20, width: 2, height: 2, color: rgb(0, 0, 0) });
  }
  await save('margins-2.pdf', doc);
}

// landscape-1
{
  const doc = await newDoc();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([842, 595]);
  page.drawText('L1', { x: 390, y: 500, size: 60, font, color: rgb(0, 0, 0) });
  for (let s = 0; s < 4; s++) {
    stave(page, 60, 780, 430 - s * 90);
    notes(page, 60, 422 - s * 90, 14, s);
  }
  await save('landscape-1.pdf', doc);
}

writeFileSync(join(out, 'corrupt.pdf'), s3.slice(0, 300));
console.log('fixtures: corrupt.pdf 300 bytes');
writeFileSync(join(out, 'not-a-pdf.pdf'), 'hello');
console.log('fixtures: not-a-pdf.pdf 5 bytes');
