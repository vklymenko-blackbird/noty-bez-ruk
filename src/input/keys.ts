import type { NavAction, Settings } from '../contracts';

/** Maps a key event to a page action. Key repeat never navigates. */
export function keyToAction(e: { key: string; repeat: boolean }, s: Pick<Settings, 'keysNext' | 'keysPrev'>): NavAction | null {
  if (e.repeat) return null;
  if (s.keysNext.includes(e.key)) return 'next';
  if (s.keysPrev.includes(e.key)) return 'prev';
  return null;
}

/** Elements that take typed text. Keys typed there must reach the element. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable === true;
}

/**
 * Listens to keydown on the window. Matching keys run onAction and call preventDefault.
 * Keys with Meta, Ctrl or Alt are left to the browser. Keys typed in form fields are left alone.
 * Returns a function that removes the listener.
 */
export function attachKeyNav(target: Window, getSettings: () => Settings, onAction: (a: NavAction) => void): () => void {
  const handler = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;
    const a = keyToAction(e, getSettings());
    if (!a) return;
    e.preventDefault();
    onAction(a);
  };
  target.addEventListener('keydown', handler);
  return () => target.removeEventListener('keydown', handler);
}
