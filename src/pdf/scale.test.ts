import { describe, expect, it } from 'vitest';
import { computeRenderSize, DEFAULT_MAX_PIXELS } from './scale';

describe('computeRenderSize', () => {
  it('fits a full A4 page to cssWidth * dpr', () => {
    const r = computeRenderSize(595, 842, { cssWidth: 300, dpr: 2 });
    expect(r.width).toBe(600);
    expect(r.height).toBe(Math.round(842 * (600 / 595)));
    expect(r.scale).toBeCloseTo(600 / 595, 6);
  });

  it('uses the full page when crop is omitted or FULL_PAGE', () => {
    const a = computeRenderSize(595, 842, { cssWidth: 300, dpr: 2 });
    const b = computeRenderSize(595, 842, { cssWidth: 300, dpr: 2, crop: { x: 0, y: 0, w: 1, h: 1 } });
    expect(b).toEqual(a);
  });

  it('sizes the cropped region: the crop width maps to cssWidth * dpr', () => {
    const r = computeRenderSize(595, 842, { cssWidth: 300, dpr: 2, crop: { x: 0.2, y: 0.2, w: 0.6, h: 0.6 } });
    expect(r.width).toBe(600);
    expect(Math.abs(r.height - (600 * 842) / 595)).toBeLessThanOrEqual(1);
  });

  it('caps the canvas at maxPixels and keeps the aspect ratio', () => {
    const r = computeRenderSize(595, 842, { cssWidth: 4000, dpr: 2 }, 8_000_000);
    expect(r.width * r.height).toBeLessThanOrEqual(8_000_000);
    expect(r.height / r.width).toBeCloseTo(842 / 595, 1);
  });

  it('uses 8 MP as the default cap', () => {
    const r = computeRenderSize(595, 842, { cssWidth: 10_000, dpr: 2 });
    expect(DEFAULT_MAX_PIXELS).toBe(8_000_000);
    expect(r.width * r.height).toBeLessThanOrEqual(8_000_000);
  });

  it('does not cap a canvas that is already under the limit', () => {
    const r = computeRenderSize(595, 842, { cssWidth: 300, dpr: 2 }, 8_000_000);
    expect(r.scale).toBeCloseTo(600 / 595, 6);
  });

  it('keeps at least 1 px on each side for tiny sizes', () => {
    const r = computeRenderSize(595, 842, { cssWidth: 0, dpr: 1 });
    expect(r.width).toBeGreaterThanOrEqual(1);
    expect(r.height).toBeGreaterThanOrEqual(1);
    const t = computeRenderSize(1, 1, { cssWidth: 1, dpr: 1 });
    expect(t).toEqual({ width: 1, height: 1, scale: 1 });
  });

  it('returns 1 x 1 for a degenerate page size', () => {
    expect(computeRenderSize(0, 0, { cssWidth: 300, dpr: 2 })).toEqual({ width: 1, height: 1, scale: 1 });
  });
});
