import type { NavAction } from '../contracts';

const TAP_MAX_MOVE_PX = 10;
const TAP_MAX_MS = 500;
const SWIPE_MIN_PX = 48;
const SWIPE_RATIO = 1.5;
const SWIPE_MAX_MS = 600;

/** Which zone of the element an x position falls in. Thirds: prev | menu | next. */
export function zoneForPoint(x: number, width: number): NavAction {
  if (width <= 0) return 'menu';
  const r = x / width;
  if (r < 1 / 3) return 'prev';
  if (r > 2 / 3) return 'next';
  return 'menu';
}

interface Start {
  id: number;
  x: number;
  y: number;
  t: number;
}

/**
 * Tap and swipe navigation on one element (SPEC 1.6).
 * - Only the first pointer is tracked. A second pointer cancels the gesture, and
 *   nothing is tracked again until every pointer is up.
 * - A pointer that starts inside [data-nav-ignore] is not tracked.
 * - opts.ignorePen: pen pointers are ignored completely.
 * - Tap: moved under 10 px and held under 500 ms. Its zone decides the action.
 * - Swipe: |dx| >= 48, |dx| > 1.5 * |dy|, under 600 ms. Left = next, right = prev.
 * Durations use event.timeStamp.
 * Returns a function that removes the listeners.
 */
export function attachPointerNav(el: HTMLElement, onAction: (a: NavAction) => void, opts?: { ignorePen?: boolean }): () => void {
  const ignorePen = opts?.ignorePen === true;
  const down = new Set<number>();
  let blocked = false;
  let active: Start | null = null;

  const isIgnoredTarget = (target: EventTarget | null): boolean => {
    const node = target as Element | null;
    return typeof node?.closest === 'function' && node.closest('[data-nav-ignore]') !== null;
  };

  const onDown = (e: PointerEvent) => {
    if (ignorePen && e.pointerType === 'pen') return;
    down.add(e.pointerId);
    if (down.size > 1) {
      active = null;
      blocked = true;
      return;
    }
    if (blocked || isIgnoredTarget(e.target)) {
      active = null;
      return;
    }
    active = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp };
    try {
      el.setPointerCapture?.(e.pointerId);
    } catch {
      /* capture is optional; pointerup may then land outside el */
    }
  };

  const release = (e: PointerEvent): Start | null => {
    down.delete(e.pointerId);
    if (down.size === 0) blocked = false;
    if (!active || active.id !== e.pointerId) return null;
    const started = active;
    active = null;
    return started;
  };

  const onUp = (e: PointerEvent) => {
    const started = release(e);
    if (!started) return;
    const dx = e.clientX - started.x;
    const dy = e.clientY - started.y;
    const dist = Math.hypot(dx, dy);
    const dt = e.timeStamp - started.t;

    if (dist < TAP_MAX_MOVE_PX && dt < TAP_MAX_MS) {
      const rect = el.getBoundingClientRect();
      onAction(zoneForPoint(started.x - rect.left, rect.width));
      return;
    }
    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > SWIPE_RATIO * Math.abs(dy) && dt < SWIPE_MAX_MS) {
      onAction(dx < 0 ? 'next' : 'prev');
    }
  };

  const onCancel = (e: PointerEvent) => {
    release(e);
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);

  return () => {
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onCancel);
    down.clear();
    active = null;
    blocked = false;
  };
}
