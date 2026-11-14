/** Shared state between the play screen and the updater. No service worker code here, so screens can import it. */
let guard: (() => boolean) | null = null;
let removed: () => void = () => undefined;

/** Test seam: the real reload is replaced in unit tests. */
export const pageActions = {
  reload(): void {
    window.location.reload();
  },
};

export function hasUnsavedNotes(): boolean {
  try {
    return guard ? guard() : false;
  } catch {
    return false;
  }
}

export function onGuardRemoved(cb: () => void): void {
  removed = cb;
}

/** The play screen tells the updater whether a note session has unsaved changes. Returns a remover. */
export function setUnsavedNotesGuard(fn: () => boolean): () => void {
  guard = fn;
  return () => {
    if (guard === fn) guard = null;
    removed();
  };
}
