import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { AppError, FULL_PAGE, type PdfDoc, type RenderOptions } from '../contracts';
import { computeRenderSize } from './scale';

/**
 * The LEGACY build is used on purpose. The default build needs newer
 * JavaScript APIs that older iPadOS versions do not have. Do not import the
 * modern build anywhere in src.
 */
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const OPEN_TIMEOUT_MS = 20_000;
/** Lets pdf.js downscale big scanned images in the worker (iPadOS canvas limit). */
const CANVAS_MAX_AREA_BYTES = 16_777_216 * 4;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('pdf-open-timeout')), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

class PdfEngine implements PdfDoc {
  readonly pageCount: number;
  private readonly doc: PDFDocumentProxy;
  private readonly task: PDFDocumentLoadingTask;
  private queue: Promise<unknown> = Promise.resolve();
  private destroyed = false;

  constructor(doc: PDFDocumentProxy, task: PDFDocumentLoadingTask) {
    this.doc = doc;
    this.task = task;
    this.pageCount = doc.numPages;
  }

  async getPageSize(page: number): Promise<{ width: number; height: number }> {
    this.assertAlive();
    const pdfPage = await this.doc.getPage(page);
    try {
      const vp = pdfPage.getViewport({ scale: 1 });
      return { width: vp.width, height: vp.height };
    } finally {
      pdfPage.cleanup();
    }
  }

  renderPage(page: number, opts: RenderOptions): Promise<HTMLCanvasElement> {
    // Renders run one after another; a failed render does not block the queue.
    const next = this.queue.then(() => this.render(page, opts));
    this.queue = next.catch(() => undefined);
    return next;
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    await this.task.destroy();
  }

  private assertAlive(): void {
    if (this.destroyed) throw new AppError('pdf-open-failed', 'document destroyed');
  }

  private async render(page: number, opts: RenderOptions): Promise<HTMLCanvasElement> {
    this.assertAlive();
    const crop = opts.crop ?? FULL_PAGE;
    const pdfPage = await this.doc.getPage(page);
    try {
      const base = pdfPage.getViewport({ scale: 1 });
      const size = computeRenderSize(base.width, base.height, { ...opts, crop });
      const fullWidthPx = base.width * size.scale;
      const fullHeightPx = base.height * size.scale;

      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new AppError('pdf-open-failed', 'no 2d context');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size.width, size.height);

      const viewport = pdfPage.getViewport({
        scale: size.scale,
        offsetX: -crop.x * fullWidthPx,
        offsetY: -crop.y * fullHeightPx,
      });
      await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;
      return canvas;
    } finally {
      pdfPage.cleanup();
    }
  }
}

/**
 * Opens a PDF from bytes. Any failure (corrupt file, password, timeout)
 * rejects with AppError('pdf-open-failed') and destroys the loading task.
 */
export async function openPdf(data: ArrayBuffer): Promise<PdfDoc> {
  const base = import.meta.env.BASE_URL;
  const task = pdfjs.getDocument({
    data: new Uint8Array(data.slice(0)),
    enableXfa: false,
    disableAutoFetch: true,
    disableStream: true,
    cMapUrl: `${base}pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}pdfjs/standard_fonts/`,
    wasmUrl: `${base}pdfjs/wasm/`,
    canvasMaxAreaInBytes: CANVAS_MAX_AREA_BYTES,
  });
  try {
    const doc = await withTimeout(task.promise, OPEN_TIMEOUT_MS);
    return new PdfEngine(doc, task);
  } catch {
    void task.destroy().catch(() => undefined);
    throw new AppError('pdf-open-failed');
  }
}
