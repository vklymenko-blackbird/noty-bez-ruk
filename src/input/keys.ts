import type { NavAction, Settings } from '../contracts';

export function keyToAction(e: { key: string; repeat: boolean }, s: Pick<Settings, 'keysNext' | 'keysPrev'>): NavAction | null {
  if (e.repeat) return null;
  if (s.keysNext.includes(e.key)) return 'next';
  if (s.keysPrev.includes(e.key)) return 'prev';
  return null;
}

export function attachKeyNav(target: Window, getSettings: () => Settings, onAction: (a: NavAction) => void): () => void {
  const handler = (e: KeyboardEvent) => {
    const a = keyToAction(e, getSettings());
    if (!a) return;
    e.preventDefault();
    onAction(a);
  };
  target.addEventListener('keydown', handler);
  return () => target.removeEventListener('keydown', handler);
}
