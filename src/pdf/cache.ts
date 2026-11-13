import type { PageCache, PdfDoc, RenderOptions } from '../contracts';

/** STUB: replaced by package pdf-engine. No caching. */
export function createPageCache(doc: PdfDoc, _max?: number): PageCache {
  return {
    get: (page: number, opts: RenderOptions) => doc.renderPage(page, opts),
    setVisible() {},
    prefetch() {},
    clear() {},
  };
}
