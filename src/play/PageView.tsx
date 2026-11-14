import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { FULL_PAGE, type CropBox, type PageCache, type PageViewProps } from '../contracts';
import { getCropBox, paperClass } from '../paper';
import { createPageCache } from '../pdf';
import { Button, Spinner } from '../ui';
import { t } from '../i18n';
import './pageview.css';

const MIN_RATIO = 0.3;
const MAX_RATIO = 0.7;

interface LayerData {
  role: 'base' | 'top';
  page: number;
  crop: CropBox;
  canvas: HTMLCanvasElement;
}

interface ViewData {
  layers: LayerData[];
  /** Aspect ratio (width / height) of the base page box. */
  aspect: number;
  half: boolean;
  /** Raises on each change that needs a fresh animation. */
  fade: number;
  wipe: number;
}

function clampRatio(r: number): number {
  if (!Number.isFinite(r)) return 0.5;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));
}

/** Largest box with the given aspect that fits inside the root, centred. */
function containBox(rootW: number, rootH: number, aspect: number) {
  if (rootW <= 0 || rootH <= 0 || !(aspect > 0)) return { w: 0, h: 0, left: 0, top: 0 };
  let w = rootW;
  let h = w / aspect;
  if (h > rootH) {
    h = rootH;
    w = h * aspect;
  }
  return { w, h, left: (rootW - w) / 2, top: (rootH - h) / 2 };
}

function clipFor(ratio: number): string {
  return `inset(0 0 ${((1 - ratio) * 100).toFixed(3)}% 0)`;
}

/** Puts the canvas first in the layer and removes any older canvas. Never uses innerHTML. */
function placeCanvas(layer: HTMLElement, canvas: HTMLCanvasElement): void {
  for (const child of Array.from(layer.children)) {
    if (child instanceof HTMLCanvasElement && child !== canvas) child.remove();
  }
  if (layer.firstChild !== canvas) layer.insertBefore(canvas, layer.firstChild);
}

export default function PageView(props: PageViewProps) {
  const { doc, position, paper, crop, renderOverlay, onDividerChange } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cacheRef = useRef<PageCache | null>(null);
  const token = useRef(0);
  const prev = useRef<{ page: number; half: boolean } | null>(null);
  const counters = useRef({ fade: 0, wipe: 0 });
  const [root, setRoot] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<ViewData | null>(null);
  const [failedPage, setFailedPageState] = useState<number | null>(null);
  const failedRef = useRef<number | null>(null);
  const setFailedPage = (p: number | null) => {
    failedRef.current = p;
    setFailedPageState(p);
  };
  const [retryTick, setRetryTick] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startRatio: number; height: number; ratio: number } | null>(null);
  const ratio = drag ?? clampRatio(props.dividerRatio);

  // Measure the root.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => setRoot({ w: el.clientWidth, h: el.clientHeight });
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // One cache per document.
  useEffect(() => {
    const cache = createPageCache(doc, 4);
    cacheRef.current = cache;
    prev.current = null;
    setView(null);
    setFailedPage(null);
    return () => {
      token.current++;
      cache.clear();
      if (cacheRef.current === cache) cacheRef.current = null;
    };
  }, [doc]);

  // Load the visible pages and prefetch the neighbours.
  useEffect(() => {
    const cache = cacheRef.current;
    if (!cache || root.w <= 0 || root.h <= 0) return;
    const mine = ++token.current;
    const page = position.page;
    const half = position.half && page + 1 <= doc.pageCount;
    // After a failure the old page is stale: drop it so a pending retry shows the spinner.
    if (failedRef.current !== null) setView(null);
    setFailedPage(null);
    (async () => {
      const pages = half ? [page, page + 1] : [page];
      const crops = await Promise.all(pages.map((p) => (crop ? getCropBox(doc, p) : Promise.resolve(FULL_PAGE))));
      const size = await doc.getPageSize(page);
      if (mine !== token.current) return;
      const baseCrop = crops[0] ?? FULL_PAGE;
      const aspect = (size.width * baseCrop.w) / (size.height * baseCrop.h);
      const box = containBox(root.w, root.h, aspect);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cache.setVisible(pages);
      const canvases = await Promise.all(
        pages.map((p, i) => cache.get(p, { cssWidth: box.w, dpr, crop: crops[i] ?? FULL_PAGE })),
      );
      if (mine !== token.current) return;
      const layers: LayerData[] = pages.map((p, i) => ({
        role: i === 0 ? 'base' : 'top',
        page: p,
        crop: crops[i] ?? FULL_PAGE,
        canvas: canvases[i]!,
      }));
      const before = prev.current;
      if (before) {
        if (!before.half && !half && before.page !== page) counters.current.fade++;
        if (!before.half && half && before.page === page) counters.current.wipe++;
      }
      prev.current = { page, half };
      setView({ layers, aspect, half, fade: counters.current.fade, wipe: counters.current.wipe });
      // Prefetch only what is needed next, so prefetched pages do not evict visible ones.
      const prefetchPages = half ? [page + 2] : [page + 1, page - 1];
      for (const p of prefetchPages) {
        if (p >= 1 && p <= doc.pageCount) {
          void getCropBox(doc, p)
            .catch(() => FULL_PAGE)
            .then((c) => {
              if (mine !== token.current) return;
              const useCrop = crop ? c : FULL_PAGE;
              cache.prefetch(p, { cssWidth: box.w, dpr, crop: useCrop });
            });
        }
      }
    })().catch(() => {
      // Do not keep showing another page: say that this page failed and offer a retry.
      if (mine === token.current) setFailedPage(page);
    });
    return () => {
      // A newer run bumps the token itself; this only invalidates on unmount of the effect.
    };
  }, [doc, position.page, position.half, crop, root.w, root.h, retryTick]);

  // Put canvases into the layers after each render.
  useLayoutEffect(() => {
    if (!view) return;
    for (const layer of view.layers) {
      const el = layerRefs.current[layer.role];
      if (el) placeCanvas(el, layer.canvas);
    }
  });

  const box = useMemo(() => containBox(root.w, root.h, view?.aspect ?? 0), [root.w, root.h, view?.aspect]);

  const onPointerDown = (e: PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture?.(e.pointerId);
    dragRef.current = { startY: e.clientY, startRatio: ratio, height: box.h || 1, ratio };
    setDrag(ratio);
    e.preventDefault();
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    d.ratio = clampRatio(d.startRatio + (e.clientY - d.startY) / d.height);
    setDrag(d.ratio);
  };
  const endDrag = (e: PointerEvent, commit: boolean) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    setDrag(null);
    if (commit) onDividerChange?.(d.ratio);
  };

  const layers = view?.layers ?? [];
  const showHalf = !!view?.half && layers.length > 1;

  return (
    <div class="pv" data-testid="pv" ref={rootRef}>
      {failedPage !== null ? (
        <div class="pv-error" data-testid="pv-error" role="alert">
          <p class="pv-error__text">{t('play.pageFailed', { page: failedPage })}</p>
          <div class="pv-error__action" data-nav-ignore>
            <Button variant="primary" onClick={() => setRetryTick((n) => n + 1)} data-testid="pv-retry">
              {t('play.pageRetry')}
            </Button>
          </div>
        </div>
      ) : view === null ? (
        <div class="pv-loading">
          <Spinner />
        </div>
      ) : (
        <>
          {layers.map((layer) => {
            const isTop = layer.role === 'top';
            const style: Record<string, string> = {
              width: `${box.w}px`,
              height: `${box.h}px`,
              left: `${box.left}px`,
              top: `${box.top}px`,
            };
            let cls = `pv-layer ${paperClass(paper)}`;
            if (isTop) {
              style.clipPath = clipFor(ratio);
              style['--pv-clip'] = `${((1 - ratio) * 100).toFixed(3)}%`;
              if (view.wipe > 0) cls += ' pv-wipe';
            } else if (view.fade > 0) {
              cls += ' pv-fade';
            }
            const key = isTop ? `top-${view.wipe}` : `base-${view.fade}`;
            return (
              <div
                key={key}
                class={cls}
                style={style}
                data-testid="pv-layer"
                data-page={String(layer.page)}
                data-role={layer.role}
                ref={(el) => {
                  layerRefs.current[layer.role] = el;
                }}
              >
                <div class="pv-overlay">{renderOverlay?.({ page: layer.page, crop: layer.crop })}</div>
              </div>
            );
          })}
          {showHalf ? (
            <div
              class="pv-divider"
              data-testid="pv-divider"
              data-nav-ignore
              style={{ width: `${box.w}px`, left: `${box.left}px`, top: `${box.top + ratio * box.h}px` }}
            >
              <div
                class="pv-notch"
                data-testid="pv-notch"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={(e) => endDrag(e, true)}
                onPointerCancel={(e) => endDrag(e, false)}
              >
                <span class="pv-pill">½</span>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
