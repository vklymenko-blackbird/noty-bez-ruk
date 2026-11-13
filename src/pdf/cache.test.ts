import { describe, expect, it } from 'vitest';
import type { PdfDoc, RenderOptions } from '../contracts';
import { createPageCache } from './cache';

interface FakeCanvas {
  width: number;
  height: number;
  page: number;
  cssWidth: number;
}

/** A fake document. Each render is a plain object; the test resolves renders by hand. */
function fakeDoc() {
  const renders: { page: number; opts: RenderOptions; canvas: FakeCanvas; resolve: () => void; reject: (e: unknown) => void }[] = [];
  let calls = 0;
  const doc = {
    pageCount: 20,
    async getPageSize() {
      return { width: 595, height: 842 };
    },
    renderPage(page: number, opts: RenderOptions) {
      calls += 1;
      const canvas: FakeCanvas = { width: 10, height: 10, page, cssWidth: opts.cssWidth };
      return new Promise<FakeCanvas>((resolve, reject) => {
        renders.push({ page, opts, canvas, resolve: () => resolve(canvas), reject });
      }) as unknown as Promise<HTMLCanvasElement>;
    },
    async destroy() {},
  } satisfies PdfDoc;
  return { doc: doc as unknown as PdfDoc, renders, calls: () => calls };
}

/** Lets pending promise callbacks run. */
const tick = () => new Promise((r) => setTimeout(r, 0));

const opts = (cssWidth = 300): RenderOptions => ({ cssWidth, dpr: 2 });

describe('createPageCache', () => {
  it('shares one in-flight render between two calls for the same key', async () => {
    const f = fakeDoc();
    const cache = createPageCache(f.doc, 3);
    const a = cache.get(1, opts());
    const b = cache.get(1, opts());
    expect(f.calls()).toBe(1);
    f.renders[0]!.resolve();
    expect(await a).toBe(await b);
  });

  it('returns the cached canvas on a hit without rendering again', async () => {
    const f = fakeDoc();
    const cache = createPageCache(f.doc, 3);
    const first = cache.get(1, opts());
    f.renders[0]!.resolve();
    const canvas = await first;
    const second = await cache.get(1, opts());
    expect(second).toBe(canvas);
    expect(f.calls()).toBe(1);
  });

  it('evicts the least recent entry first and a hit refreshes the order', async () => {
    const f = fakeDoc();
    const cache = createPageCache(f.doc, 2);
    cache.setVisible([]);
    const p1 = cache.get(1, opts());
    f.renders[0]!.resolve();
    const c1 = await p1;
    const p2 = cache.get(2, opts());
    f.renders[1]!.resolve();
    await p2;
    // Touch page 1 so page 2 becomes the least recent.
    await cache.get(1, opts());
    const p3 = cache.get(3, opts());
    f.renders[2]!.resolve();
    await p3;
    await tick();
    // Page 2 was evicted, page 1 survived.
    expect(await cache.get(1, opts())).toBe(c1);
    expect(f.calls()).toBe(3);
    // Page 2 was evicted, so asking again starts a new render.
    void cache.get(2, opts());
    expect(f.calls()).toBe(4);
  });

  it('never evicts a visible page, even when the cache is over its limit', async () => {
    const f = fakeDoc();
    const cache = createPageCache(f.doc, 1);
    cache.setVisible([1, 2]);
    const p1 = cache.get(1, opts());
    f.renders[0]!.resolve();
    const c1 = await p1;
    const p2 = cache.get(2, opts());
    f.renders[1]!.resolve();
    await p2;
    await tick();
    expect(c1.width).toBe(10);
    expect(await cache.get(1, opts())).toBe(c1);
    expect(f.calls()).toBe(2);
  });

  it('zeroes the canvas of an evicted entry', async () => {
    const f = fakeDoc();
    const cache = createPageCache(f.doc, 1);
    cache.setVisible([]);
    const p1 = cache.get(1, opts());
    f.renders[0]!.resolve();
    const c1 = (await p1) as unknown as FakeCanvas;
    const p2 = cache.get(2, opts());
    f.renders[1]!.resolve();
    await p2;
    await tick();
    expect(c1.width).toBe(0);
    expect(c1.height).toBe(0);
  });

  it('a new size for a page replaces the old entry of that page', async () => {
    const f = fakeDoc();
    const cache = createPageCache(f.doc, 3);
    const p1 = cache.get(1, opts(300));
    f.renders[0]!.resolve();
    const old = (await p1) as unknown as FakeCanvas;
    const p2 = cache.get(1, opts(600));
    f.renders[1]!.resolve();
    const fresh = await p2;
    await tick();
    expect(old.width).toBe(0);
    expect(fresh).not.toBe(old);
    expect(await cache.get(1, opts(600))).toBe(fresh);
    expect(f.calls()).toBe(2);
  });

  it('a different crop is a different key', async () => {
    const f = fakeDoc();
    const cache = createPageCache(f.doc, 3);
    const a = cache.get(1, { cssWidth: 300, dpr: 2 });
    const b = cache.get(1, { cssWidth: 300, dpr: 2, crop: { x: 0.1, y: 0, w: 0.9, h: 1 } });
    expect(f.calls()).toBe(2);
    f.renders[0]!.resolve();
    f.renders[1]!.resolve();
    await Promise.all([a, b]);
  });

  it('prefetch swallows render errors and does not cache a failure', async () => {
    const f = fakeDoc();
    const cache = createPageCache(f.doc, 3);
    cache.prefetch(1, opts());
    f.renders[0]!.reject(new Error('boom'));
    await tick();
    const next = cache.get(1, opts());
    expect(f.calls()).toBe(2);
    f.renders[1]!.resolve();
    await next;
  });

  it('clear evicts everything and zeroes the canvases', async () => {
    const f = fakeDoc();
    const cache = createPageCache(f.doc, 3);
    const p1 = cache.get(1, opts());
    const p2 = cache.get(2, opts());
    f.renders[0]!.resolve();
    f.renders[1]!.resolve();
    const c1 = (await p1) as unknown as FakeCanvas;
    const c2 = (await p2) as unknown as FakeCanvas;
    cache.clear();
    await tick();
    expect(c1.width).toBe(0);
    expect(c2.width).toBe(0);
    void cache.get(1, opts());
    expect(f.calls()).toBe(3);
  });
});
