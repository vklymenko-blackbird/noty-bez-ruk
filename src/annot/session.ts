import {
  MAX_MARKS_PER_PAGE,
  type AnnotSession,
  type AnnotToolState,
  type Mark,
  type ScoreId,
  type StorageApi,
} from '../contracts';
import { hitTest, validateMarks } from './model';

const MAX_HISTORY = 50;

interface PageState {
  committed: Mark[];      // last saved (or loaded) list; treated as immutable
  current: Mark[];        // list shown to the user; treated as immutable
  undo: Mark[][];
  redo: Mark[][];
  loaded: boolean;
  edited: boolean;        // changed at least once since the page was created
}

function emptyPage(): PageState {
  return { committed: [], current: [], undo: [], redo: [], loaded: false, edited: false };
}

/** Two lists are the same when they hold the same mark objects in the same order. */
function sameMarks(a: Mark[], b: Mark[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Thrown by commit when some pages could not be read first, so their saved marks stay untouched. */
export class AnnotLoadError extends Error {
  readonly pages: number[];
  constructor(pages: number[]) {
    super('annot load failed');
    this.name = 'AnnotLoadError';
    this.pages = pages;
  }
}

export function createAnnotSession(storage: StorageApi, scoreId: ScoreId): AnnotSession {
  let tool: AnnotToolState = { tool: 'pen', color: 'ink', stampDigit: 1 };
  const pages = new Map<number, PageState>();
  const loading = new Map<number, Promise<void>>();
  const subs = new Set<() => void>();
  let queue: Promise<void> = Promise.resolve();

  const notify = (): void => {
    subs.forEach((cb) => cb());
  };

  const pageOf = (page: number): PageState => {
    let st = pages.get(page);
    if (!st) {
      st = emptyPage();
      pages.set(page, st);
    }
    return st;
  };

  /** Records the old list for undo, clears redo and makes next the current list. */
  const pushHistory = (st: PageState, next: Mark[]): void => {
    st.undo.push(st.current);
    if (st.undo.length > MAX_HISTORY) st.undo.shift();
    st.redo = [];
    st.current = next;
    st.edited = true;
  };

  const doLoad = async (page: number): Promise<void> => {
    const raw = await storage.getMarks(scoreId, page);
    const saved = validateMarks(raw);
    const st = pageOf(page);
    st.committed = saved;
    // Marks added before the load finished stay on top of the saved marks, so they are not lost.
    // Every snapshot taken before the load lacks the saved marks: add them, so undo and redo
    // never drop what was saved. An empty snapshot becomes the saved list itself.
    if (st.edited) {
      const withSaved = (list: Mark[]): Mark[] => (list.length === 0 ? saved : [...saved, ...list]);
      st.undo = st.undo.map(withSaved);
      st.redo = st.redo.map(withSaved);
      st.current = withSaved(st.current);
    } else {
      st.current = saved;
    }
    st.loaded = true;
    notify();
  };

  const doCommit = async (): Promise<void> => {
    // Wait for any load that is still running, so a save never overwrites marks not yet read.
    await Promise.all([...loading.values()].map((p) => p.catch(() => undefined)));
    const failed: number[] = [];
    for (const [page, st] of [...pages.entries()]) {
      if (!st.loaded) {
        // Saved marks were never read. Try once more; never write over what we have not seen.
        if (sameMarks(st.current, st.committed)) continue;
        try {
          await loadPage(page);
        } catch {
          failed.push(page);
          continue;
        }
      }
      if (sameMarks(st.current, st.committed)) continue;
      const snapshot = st.current;
      await storage.setMarks(scoreId, page, snapshot);
      st.committed = snapshot;
      notify();
    }
    if (failed.length > 0) throw new AnnotLoadError(failed);
  };

  const loadPage = (page: number): Promise<void> => {
    if (pageOf(page).loaded) return Promise.resolve();
    const pending = loading.get(page);
    if (pending) return pending;
    const p = doLoad(page).finally(() => {
      loading.delete(page);
    });
    loading.set(page, p);
    return p;
  };

  return {
    getTool: () => tool,

    setTool(patch) {
      const next: AnnotToolState = { ...tool, ...patch };
      if (patch.tool === 'highlighter') {
        next.color = 'highlight';
      } else if ((patch.tool === 'pen' || patch.tool === 'stamp') && next.color === 'highlight') {
        next.color = 'ink';
      }
      tool = next;
      notify();
    },

    async load(page) {
      return loadPage(page);
    },

    getMarks: (page) => pageOf(page).current,

    addMark(page, mark) {
      const [valid] = validateMarks([mark]);
      if (!valid) return;
      const st = pageOf(page);
      if (st.current.length >= MAX_MARKS_PER_PAGE) return;
      pushHistory(st, [...st.current, valid]);
      notify();
    },

    eraseAt(page, x, y, radius) {
      const st = pageOf(page);
      const next = st.current.filter((m) => !hitTest(m, x, y, radius));
      if (next.length === st.current.length) return false;
      pushHistory(st, next);
      notify();
      return true;
    },

    undo(page) {
      const st = pageOf(page);
      const prev = st.undo.pop();
      if (prev === undefined) return;
      st.redo.push(st.current);
      st.current = prev;
      st.edited = true;
      notify();
    },

    redo(page) {
      const st = pageOf(page);
      const next = st.redo.pop();
      if (next === undefined) return;
      st.undo.push(st.current);
      st.current = next;
      st.edited = true;
      notify();
    },

    canUndo: (page) => pageOf(page).undo.length > 0,

    canRedo: (page) => pageOf(page).redo.length > 0,

    clearPage(page) {
      const st = pageOf(page);
      if (st.current.length === 0) return;
      pushHistory(st, []);
      notify();
    },

    isDirty() {
      for (const st of pages.values()) {
        if (!sameMarks(st.current, st.committed)) return true;
      }
      return false;
    },

    commit() {
      const run = queue.then(doCommit);
      queue = run.catch(() => undefined);
      return run;
    },

    revert() {
      for (const st of pages.values()) {
        st.current = st.committed;
        st.undo = [];
        st.redo = [];
        st.edited = false;
      }
      notify();
    },

    subscribe(cb) {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
  };
}
