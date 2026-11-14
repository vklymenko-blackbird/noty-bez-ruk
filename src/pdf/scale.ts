import { FULL_PAGE, type RenderOptions } from '../contracts';

/** Default cap on the number of canvas pixels for one rendered page. */
export const DEFAULT_MAX_PIXELS = 8_000_000;

/**
 * Computes the canvas size and the pdf.js scale for one page render.
 *
 * The scale maps the cropped page width to `cssWidth * dpr` device pixels.
 * When the canvas would be larger than `maxPixels`, the scale is lowered
 * so that the canvas fits. Both sides are at least 1 px.
 */
export function computeRenderSize(
  pageW: number,
  pageH: number,
  opts: RenderOptions,
  maxPixels = DEFAULT_MAX_PIXELS,
): { width: number; height: number; scale: number } {
  const crop = opts.crop ?? FULL_PAGE;
  const cropW = pageW * crop.w;
  const cropH = pageH * crop.h;
  if (!(cropW > 0) || !(cropH > 0)) return { width: 1, height: 1, scale: 1 };
  let scale = (opts.cssWidth * opts.dpr) / cropW;
  let width = Math.max(1, Math.round(cropW * scale));
  let height = Math.max(1, Math.round(cropH * scale));

  if (width * height > maxPixels) {
    scale *= Math.sqrt(maxPixels / (width * height));
    width = Math.max(1, Math.floor(cropW * scale));
    height = Math.max(1, Math.floor(cropH * scale));
  }
  return { width, height, scale };
}
