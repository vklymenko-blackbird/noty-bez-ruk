import type { RenderOptions } from '../contracts';

/** STUB (works, but minimal): replaced by package pdf-engine. */
export function computeRenderSize(
  pageW: number,
  pageH: number,
  opts: RenderOptions,
  maxPixels = 16_000_000,
): { width: number; height: number; scale: number } {
  const crop = opts.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const cropW = Math.max(1, pageW * crop.w);
  const cropH = Math.max(1, pageH * crop.h);
  let scale = (opts.cssWidth * opts.dpr) / cropW;
  const px = cropW * cropH * scale * scale;
  if (px > maxPixels) scale *= Math.sqrt(maxPixels / px);
  return { width: Math.max(1, Math.round(cropW * scale)), height: Math.max(1, Math.round(cropH * scale)), scale };
}
