import type { NavAction } from '../contracts';

export function zoneForPoint(x: number, width: number): NavAction {
  if (width <= 0) return 'menu';
  const r = x / width;
  if (r < 1 / 3) return 'prev';
  if (r > 2 / 3) return 'next';
  return 'menu';
}

/** STUB: replaced by package play-logic. A click maps to a zone. */
export function attachPointerNav(el: HTMLElement, onAction: (a: NavAction) => void, _opts?: { ignorePen?: boolean }): () => void {
  const handler = (e: MouseEvent) => {
    if ((e.target as HTMLElement | null)?.closest('[data-nav-ignore]')) return;
    const rect = el.getBoundingClientRect();
    onAction(zoneForPoint(e.clientX - rect.left, rect.width));
  };
  el.addEventListener('click', handler);
  return () => el.removeEventListener('click', handler);
}
