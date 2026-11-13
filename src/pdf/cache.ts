import { FULL_PAGE, type PageCache, type PdfDoc, type RenderOptions } from '../contracts';

interface Entry {
  page: number;
  /** Width, dpr and crop without the page. A change here replaces the entry. */
  sizeKey: string;
  promise: Promise<HTMLCanvasElement>;
}

function sizeKeyOf(opts: RenderOptions): string {
  const c = opts.crop ?? FULL_PAGE;
  return [
    Math.round(opts.cssWidth),
    opts.dpr,
    c.x.toFixed(4),
    c.y.toFixed(4),
    c.w.toFixed(4),
    c.h.toFixed(4),
  ].join('|');
}

/** Frees the GPU/memory of a canvas. Safe to call on a canvas still in use by no one. */
function release(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * LRU cache of rendered page canvases.
 * - A hit moves the entry to "most recent".
 * - Two calls for the same key share one render.
 * - A new size or crop for a page replaces the old entries of that page.
 * - Eviction keeps visible pages and zeroes the canvas of evicted entries.
 */
export function createPageCache(doc: PdfDoc, max = 3): PageCache {
  // Map keeps insertion order: the first key is the least recent.
  const entries = new Map<string, Entry>();
  let visible = new Set<number>();

  const evictKey = (key: string): void => {
    const entry = entries.get(key);
    if (!entry) return;
    entries.delete(key);
    entry.promise.then(release, () => undefined);
  };

  const enforceLimit = (keepKey: string): void => {
    for (const key of [...entries.keys()]) {
      if (entries.size <= max) break;
      if (key === keepKey) continue;
      const entry = entries.get(key);
      if (!entry || visible.has(entry.page)) continue;
      evictKey(key);
    }
  };

  const keyOf = (page: number, opts: RenderOptions): string => `${page}#${sizeKeyOf(opts)}`;

  const get = (page: number, opts: RenderOptions): Promise<HTMLCanvasElement> => {
    const key = keyOf(page, opts);
    const hit = entries.get(key);
    if (hit) {
      entries.delete(key);
      entries.set(key, hit);
      return hit.promise;
    }

    const sizeKey = sizeKeyOf(opts);
    for (const [oldKey, old] of [...entries]) {
      if (old.page === page && old.sizeKey !== sizeKey) evictKey(oldKey);
    }

    let promise: Promise<HTMLCanvasElement>;
    try {
      promise = doc.renderPage(page, opts);
    } catch (err) {
      promise = Promise.reject(err);
    }
    const entry: Entry = { page, sizeKey, promise };
    entries.set(key, entry);
    // A failed render must not stay in the cache, so the next call retries.
    promise.catch(() => {
      if (entries.get(key) === entry) entries.delete(key);
    });
    enforceLimit(key);
    return promise;
  };

  return {
    get,
    setVisible(pages: number[]) {
      visible = new Set(pages);
    },
    prefetch(page: number, opts: RenderOptions) {
      get(page, opts).catch(() => undefined);
    },
    clear() {
      for (const key of [...entries.keys()]) evictKey(key);
    },
  };
}
