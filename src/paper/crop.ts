import { FULL_PAGE, type CropBox, type PdfDoc } from '../contracts';

/** Pixels darker than this (luminance 0..255) count as page content. */
const DARK_LUMA = 200;
/** Padding on each side, as a fraction of the page. */
const PAD = 0.02;
/** Smallest padded box size (fraction of the page) that we trust. */
const MIN_SIZE = 0.5;
/** Largest cut per side (fraction of the page). */
const MAX_CUT = 0.18;
/** A side must cut more than this to be worth applying. */
const MIN_CUT = 0.02;
/** Low-resolution render width used for detection. */
const RENDER_WIDTH = 240;

type Img = { data: Uint8ClampedArray; width: number; height: number };

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/**
 * Find the content box of a low-resolution white-paper image.
 * Returns fractions of the page. Falls back to the full page when the
 * result is not safe.
 */
export function computeCropBox(img: Img): CropBox {
  const { data, width, height } = img;
  if (width <= 0 || height <= 0) return { ...FULL_PAGE };

  const rowCount = new Uint32Array(height);
  const colCount = new Uint32Array(width);
  for (let y = 0; y < height; y++) {
    const rowBase = y * width;
    for (let x = 0; x < width; x++) {
      const i = (rowBase + x) * 4;
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (luma < DARK_LUMA) {
        rowCount[y]++;
        colCount[x]++;
      }
    }
  }

  const rowMin = Math.max(2, Math.ceil(0.01 * width));
  const colMin = Math.max(2, Math.ceil(0.01 * height));

  let top = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    if (rowCount[y] >= rowMin) {
      if (top < 0) top = y;
      bottom = y;
    }
  }
  let left = -1;
  let right = -1;
  for (let x = 0; x < width; x++) {
    if (colCount[x] >= colMin) {
      if (left < 0) left = x;
      right = x;
    }
  }

  // (1) No content: keep the full page.
  if (top < 0 || left < 0) return { ...FULL_PAGE };

  // (2) Content box as fractions, plus padding, clamped to the page.
  let x0 = left / width - PAD;
  let x1 = (right + 1) / width + PAD;
  let y0 = top / height - PAD;
  let y1 = (bottom + 1) / height + PAD;
  x0 = Math.max(0, x0);
  x1 = Math.min(1, x1);
  y0 = Math.max(0, y0);
  y1 = Math.min(1, y1);

  // (3) Too little content for a safe guess.
  if (x1 - x0 < MIN_SIZE || y1 - y0 < MIN_SIZE) return { ...FULL_PAGE };

  // (4) Never cut more than MAX_CUT from any side.
  x0 = Math.min(x0, MAX_CUT);
  y0 = Math.min(y0, MAX_CUT);
  x1 = Math.max(x1, 1 - MAX_CUT);
  y1 = Math.max(y1, 1 - MAX_CUT);

  // (5) Nothing worth cutting.
  const biggestCut = Math.max(x0, y0, 1 - x1, 1 - y1);
  if (biggestCut <= MIN_CUT) return { ...FULL_PAGE };

  // (6) Result.
  return {
    x: round4(x0),
    y: round4(y0),
    w: round4(x1 - x0),
    h: round4(y1 - y0),
  };
}

const cache = new WeakMap<PdfDoc, Map<number, Promise<CropBox>>>();

async function detect(doc: PdfDoc, page: number): Promise<CropBox> {
  let canvas: HTMLCanvasElement | null = null;
  try {
    canvas = await doc.renderPage(page, { cssWidth: RENDER_WIDTH, dpr: 1 });
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ...FULL_PAGE };
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return computeCropBox({ data: pixels.data, width: canvas.width, height: canvas.height });
  } catch {
    return { ...FULL_PAGE };
  } finally {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

/** Crop box for one page. Memoised per document and page. Never rejects. */
export function getCropBox(doc: PdfDoc, page: number): Promise<CropBox> {
  let perDoc = cache.get(doc);
  if (!perDoc) {
    perDoc = new Map();
    cache.set(doc, perDoc);
  }
  let pending = perDoc.get(page);
  if (!pending) {
    pending = detect(doc, page);
    perDoc.set(page, pending);
  }
  return pending;
}
