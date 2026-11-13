import type { AnnotSession, AnnotToolState, ScoreId, StorageApi } from '../contracts';

/** STUB: replaced by package annot-engine. Keeps nothing. */
export function createAnnotSession(_storage: StorageApi, _scoreId: ScoreId): AnnotSession {
  let tool: AnnotToolState = { tool: 'pen', color: 'ink', stampDigit: 1 };
  const subs = new Set<() => void>();
  return {
    getTool: () => tool,
    setTool(patch) {
      tool = { ...tool, ...patch };
      subs.forEach((cb) => cb());
    },
    async load() {},
    getMarks: () => [],
    addMark() {},
    eraseAt: () => false,
    undo() {},
    redo() {},
    canUndo: () => false,
    canRedo: () => false,
    clearPage() {},
    isDirty: () => false,
    async commit() {},
    revert() {},
    subscribe(cb) {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
  };
}
