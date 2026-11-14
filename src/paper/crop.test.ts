import { describe, it, expect, vi } from 'vitest';
import { FULL_PAGE, type PdfDoc } from '../contracts';
import { computeCropBox, getCropBox } from './crop';

const W = 200;
const H = 200;

type Rect = [number, number, number, number];

/** White RGBA image with black rectangles. Rects are pixel coords, end exclusive. */
function makeImage(width: number, height: number, rects: Rect[]) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const [x0, y0, x1, y1] of rects) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
      }
    }
  }
  return { data, width, height };
}

function expectFull(box: { x: number; y: number; w: number; h: number }) {
  expect(box).toEqual(FULL_PAGE);
}

describe('computeCropBox', () => {
  it('white page gives the full page', () => {
    expectFull(computeCropBox(makeImage(W, H, [])));
  });

  it('a centred block of 60 % x 70 % gives a box near the block plus padding', () => {
    // x 40..160 is 20 % to 80 % of 200 px; y 30..170 is 15 % to 85 %.
    const box = computeCropBox(makeImage(W, H, [[40, 30, 160, 170]]));
    expect(box.x).toBeCloseTo(0.18, 3);
    expect(box.y).toBeCloseTo(0.13, 3);
    expect(box.w).toBeCloseTo(0.64, 3);
    expect(box.h).toBeCloseTo(0.74, 3);
    // No side cuts more than 18 %.
    expect(box.x).toBeLessThanOrEqual(0.18);
    expect(box.y).toBeLessThanOrEqual(0.18);
    expect(1 - (box.x + box.w)).toBeLessThanOrEqual(0.18 + 1e-9);
    expect(1 - (box.y + box.h)).toBeLessThanOrEqual(0.18 + 1e-9);
  });

  it('returns values rounded to 4 decimals', () => {
    const box = computeCropBox(makeImage(W, H, [[40, 30, 160, 170]]));
    for (const v of [box.x, box.y, box.w, box.h]) {
      expect(Math.round(v * 10000) / 10000).toBe(v);
    }
  });

  it('ignores a single 1 px speck in a corner', () => {
    const block: Rect = [40, 30, 160, 170];
    const withSpeck = computeCropBox(makeImage(W, H, [block, [0, 0, 1, 1]]));
    const withoutSpeck = computeCropBox(makeImage(W, H, [block]));
    expect(withSpeck).toEqual(withoutSpeck);
  });

  it('a speck alone gives the full page', () => {
    expectFull(computeCropBox(makeImage(W, H, [[0, 0, 1, 1]])));
  });

  it('a tiny block (10 %) gives the full page', () => {
    expectFull(computeCropBox(makeImage(W, H, [[90, 90, 110, 110]])));
  });

  it('content that touches all edges gives the full page', () => {
    expectFull(computeCropBox(makeImage(W, H, [[0, 0, W, H]])));
  });

  it('content that cuts only about 1 % per side gives the full page', () => {
    // 1 % of 200 px is 2 px. Padding of 2 % covers it, so no side cuts more than 2 %.
    expectFull(computeCropBox(makeImage(W, H, [[2, 2, 198, 198]])));
  });

  it('handles an empty image without throwing', () => {
    expectFull(computeCropBox({ data: new Uint8ClampedArray(0), width: 0, height: 0 }));
  });
});

type FakeCanvas = {
  width: number;
  height: number;
  getContext: (kind: string) => { getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray } } | null;
};

function fakeCanvasFor(img: { data: Uint8ClampedArray; width: number; height: number }): FakeCanvas {
  const canvas: FakeCanvas = {
    width: img.width,
    height: img.height,
    getContext: () => ({ getImageData: () => ({ data: img.data }) }),
  };
  return canvas;
}

function fakeDoc(renderPage: PdfDoc['renderPage']): PdfDoc {
  return {
    pageCount: 1,
    getPageSize: async () => ({ width: 612, height: 792 }),
    renderPage,
    destroy: async () => {},
  } as unknown as PdfDoc;
}

describe('getCropBox', () => {
  it('renders once for two calls on the same page', async () => {
    const img = makeImage(W, H, [[40, 30, 160, 170]]);
    const renderPage = vi.fn(async () => fakeCanvasFor(img) as unknown as HTMLCanvasElement);
    const doc = fakeDoc(renderPage as unknown as PdfDoc['renderPage']);

    const a = await getCropBox(doc, 1);
    const b = await getCropBox(doc, 1);

    expect(renderPage).toHaveBeenCalledTimes(1);
    expect(renderPage).toHaveBeenCalledWith(1, { cssWidth: 240, dpr: 1 });
    expect(a).toEqual(b);
    expect(a.w).toBeCloseTo(0.64, 3);
  });

  it('resolves the full page when renderPage rejects', async () => {
    const doc = fakeDoc((async () => {
      throw new Error('render failed');
    }) as PdfDoc['renderPage']);
    expectFull(await getCropBox(doc, 2));
  });

  it('frees the render canvas after use', async () => {
    const img = makeImage(W, H, []);
    const canvas = fakeCanvasFor(img);
    const doc = fakeDoc((async () => canvas as unknown as HTMLCanvasElement) as PdfDoc['renderPage']);
    await getCropBox(doc, 3);
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });
});
