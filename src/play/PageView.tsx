import { useEffect, useRef } from 'preact/hooks';
import type { PageViewProps } from '../contracts';
import './pageview.css';

/** STUB: replaced by package page-view. Renders the current page canvas, no cache, no themes, no half. */
export default function PageView(props: PageViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const { doc, position } = props;
  useEffect(() => {
    let cancelled = false;
    const el = host.current;
    if (!el) return;
    const width = el.clientWidth || 744;
    doc
      .renderPage(position.page, { cssWidth: width, dpr: Math.min(window.devicePixelRatio || 1, 2) })
      .then((canvas) => {
        if (cancelled) return;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        el.replaceChildren(canvas);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [doc, position.page]);
  return <div class="pageview-stub" ref={host} data-testid="pageview" />;
}
