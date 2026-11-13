import { FULL_PAGE, type CropBox, type PdfDoc } from '../contracts';

/** STUB: replaced by package paper-crop. */
export function computeCropBox(_img: { data: Uint8ClampedArray; width: number; height: number }): CropBox {
  return { ...FULL_PAGE };
}

/** STUB: replaced by package paper-crop. */
export async function getCropBox(_doc: PdfDoc, _page: number): Promise<CropBox> {
  return { ...FULL_PAGE };
}
