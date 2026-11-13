import { AppError, type PdfDoc } from '../contracts';

/** STUB: replaced by package pdf-engine. */
export async function openPdf(_data: ArrayBuffer): Promise<PdfDoc> {
  throw new AppError('pdf-open-failed');
}
