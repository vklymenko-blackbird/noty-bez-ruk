import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../storage/memory';
import { MAX_MARKS_PER_PAGE, type Mark, type StorageApi, type StrokeMark } from '../contracts';
import { createAnnotSession } from './session';

const SCORE = 'score-1';

const stroke = (id: string, x = 0.1): StrokeMark => ({
  kind: 'stroke',
  id,
  color: 'ink',
  width: 0.004,
  points: [x, 0.1, x + 0.05, 0.1],
});

const stampAt = (id: string, x: number, y: number): Mark => ({
  kind: 'stamp',
  id,
  digit: 3,
  x,
  y,
  size: 0.03,
  color: 'ink',
});

/** A storage wrapper whose setMarks waits for a gate the test controls. */
function gatedStorage(base: StorageApi) {
  let release: (() => void) | null = null;
  let open = false;
  let fail: Error | null = null;
  const wrapper: StorageApi = {
    ...base,
    async setMarks(id, page, marks) {
      await new Promise<void>((resolve) => {
        if (open) resolve();
        else release = resolve;
      });
      if (fail) throw fail;
      return base.setMarks(id, page, marks);
    },
  };
  return {
    storage: wrapper,
    finish: () => {
      open = true;
      release?.();
    },
    failWith: (e: Error) => {
      fail = e;
    },
  };
}

/** Lets pending promise callbacks and one timer tick run. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('annotation session: tools', () => {
  it('starts with the pen, ink and stamp digit 1', () => {
    const s = createAnnotSession(createMemoryStorage(), SCORE);
    expect(s.getTool()).toEqual({ tool: 'pen', color: 'ink', stampDigit: 1 });
  });

  it('setTool merges the patch', () => {
    const s = createAnnotSession(createMemoryStorage(), SCORE);
    s.setTool({ color: 'burgundy' });
    expect(s.getTool()).toEqual({ tool: 'pen', color: 'burgundy', stampDigit: 1 });
    s.setTool({ stampDigit: 4 });
    expect(s.getTool()).toEqual({ tool: 'pen', color: 'burgundy', stampDigit: 4 });
  });

  it('choosing the highlighter sets the highlight colour', () => {
    const s = createAnnotSession(createMemoryStorage(), SCORE);
    s.setTool({ tool: 'highlighter' });
    expect(s.getTool()).toMatchObject({ tool: 'highlighter', color: 'highlight' });
  });

  it('choosing the pen or the stamp while the colour is highlight sets ink', () => {
    const s = createAnnotSession(createMemoryStorage(), SCORE);
    s.setTool({ tool: 'highlighter' });
    s.setTool({ tool: 'pen' });
    expect(s.getTool()).toMatchObject({ tool: 'pen', color: 'ink' });
    s.setTool({ tool: 'highlighter' });
    s.setTool({ tool: 'stamp' });
    expect(s.getTool()).toMatchObject({ tool: 'stamp', color: 'ink' });
  });

  it('subscribe fires on setTool and unsubscribe stops it', () => {
    const s = createAnnotSession(createMemoryStorage(), SCORE);
    let calls = 0;
    const off = s.subscribe(() => calls++);
    s.setTool({ color: 'blue' });
    expect(calls).toBe(1);
    off();
    s.setTool({ color: 'ink' });
    expect(calls).toBe(1);
  });
});

describe('annotation session: edits and history', () => {
  it('add, then undo, then redo', () => {
    const s = createAnnotSession(createMemoryStorage(), SCORE);
    s.addMark(1, stroke('a'));
    expect(s.getMarks(1)).toHaveLength(1);
    s.undo(1);
    expect(s.getMarks(1)).toEqual([]);
    expect(s.canRedo(1)).toBe(true);
    s.redo(1);
    expect(s.getMarks(1).map((m) => m.id)).toEqual(['a']);
  });

  it('canUndo and canRedo follow the stacks', () => {
    const s = createAnnotSession(createMemoryStorage(), SCORE);
    expect(s.canUndo(1)).toBe(false);
    expect(s.canRedo(1)).toBe(false);
    s.addMark(1, stroke('a'));
    expect(s.canUndo(1)).toBe(true);
    s.undo(1);
    expect(s.canUndo(1)).toBe(false);
    expect(s.canRedo(1)).toBe(true);
  });

  it('a new mark clears the redo stack', () => {
    const s = createAnnotSession(createMemoryStorage(), SCORE);
    s.addMark(1, stroke('a'));
    s.undo(1);
    s.addMark(1, stroke('b'));
    expect(s.canRedo(1)).toBe(false);
    s.redo(1);
    expect(s.getMarks(1).map((m) => m.id)).toEqual(['b']);
  });

  it('undo and redo on an empty stack do nothing', () => {
    const s = createAnnotSession(createMemoryStorage(), SCORE);
    s.undo(1);
    s.redo(1);
    expect(s.getMarks(1)).toEqual([]);
  });

  it('pages keep their own marks and history', () => {
    const s = createAnnotSession(createMemoryStorage(), SCORE);
    s.addMark(1, stroke('a'));
    s.addMark(2, stroke('b'));
    s.undo(1);
    expect(s.getMarks(1)).toEqual([]);
    expect(s.getMarks(2).map((m) => m.id)).toEqual(['b']);
  });

  it('ignores an invalid mark', () => {
    const s = createAnnotSession(createMemoryStorage(), SCORE);
    s.addMark(1, { ...stroke('x'), width: Number.NaN });
    expect(s.getMarks(1)).toEqual([]);
    expect(s.canUndo(1)).toBe(false);
  });

  it('addMark is ignored when the page is full', () => {
    const s = createAnnotSession(createMemoryStorage(), SCORE);
    for (let i = 0; i < MAX_MARKS_PER_PAGE; i++) s.addMark(1, stampAt(`p${i}`, 0.5, 0.5));
    expect(s.getMarks(1)).toHaveLength(MAX_MARKS_PER_PAGE);
    s.addMark(1, stroke('extra'));
    expect(s.getMarks(1)).toHaveLength(MAX_MARKS_PER_PAGE);
  });

  it('eraseAt removes only the touched mark and can be undone', () => {
    const s = createAnnotSession(createMemoryStorage(), SCORE);
    s.addMark(1, stroke('a', 0.1));
    s.addMark(1, stroke('b', 0.6));
    expect(s.eraseAt(1, 0.12, 0.1, 0.01)).toBe(true);
    expect(s.getMarks(1).map((m) => m.id)).toEqual(['b']);
    s.undo(1);
    expect(s.getMarks(1).map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('eraseAt returns false and changes nothing when nothing is hit', () => {
    const s = createAnnotSession(createMemoryStorage(), SCORE);
    s.addMark(1, stroke('a', 0.1));
    expect(s.eraseAt(1, 0.9, 0.9, 0.01)).toBe(false);
    expect(s.getMarks(1)).toHaveLength(1);
    expect(s.canUndo(1)).toBe(true);
    s.undo(1);
    expect(s.getMarks(1)).toEqual([]);
  });

  it('clearPage removes all marks of the page and can be undone', () => {
    const s = createAnnotSession(createMemoryStorage(), SCORE);
    s.addMark(1, stroke('a'));
    s.addMark(1, stroke('b'));
    s.clearPage(1);
    expect(s.getMarks(1)).toEqual([]);
    s.undo(1);
    expect(s.getMarks(1)).toHaveLength(2);
  });

  it('undo history is limited to 50 steps', () => {
    const s = createAnnotSession(createMemoryStorage(), SCORE);
    for (let i = 0; i < 60; i++) s.addMark(1, stampAt(`p${i}`, 0.5, 0.5));
    let undone = 0;
    while (s.canUndo(1)) {
      s.undo(1);
      undone++;
    }
    expect(undone).toBe(50);
    expect(s.getMarks(1)).toHaveLength(10);
  });

  it('subscribe fires on add, erase and undo', () => {
    const s = createAnnotSession(createMemoryStorage(), SCORE);
    let calls = 0;
    s.subscribe(() => calls++);
    s.addMark(1, stroke('a'));
    s.eraseAt(1, 0.12, 0.1, 0.01);
    s.undo(1);
    expect(calls).toBe(3);
  });
});

describe('annotation session: storage', () => {
  let storage: StorageApi;
  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('getMarks returns [] before load', () => {
    expect(createAnnotSession(storage, SCORE).getMarks(1)).toEqual([]);
  });

  it('load reads the saved marks and validates them', async () => {
    await storage.setMarks(SCORE, 1, [stroke('a')]);
    const s = createAnnotSession(storage, SCORE);
    await s.load(1);
    expect(s.getMarks(1).map((m) => m.id)).toEqual(['a']);
    expect(s.isDirty()).toBe(false);
  });

  it('load runs once per page', async () => {
    await storage.setMarks(SCORE, 1, [stroke('a')]);
    const s = createAnnotSession(storage, SCORE);
    await s.load(1);
    await s.load(1);
    await storage.setMarks(SCORE, 1, [stroke('z')]);
    await s.load(1);
    expect(s.getMarks(1).map((m) => m.id)).toEqual(['a']);
  });

  it('load notifies subscribers', async () => {
    const s = createAnnotSession(storage, SCORE);
    let calls = 0;
    s.subscribe(() => calls++);
    await s.load(1);
    expect(calls).toBeGreaterThan(0);
  });

  it('commit writes to storage and a new session loads the same marks', async () => {
    const s = createAnnotSession(storage, SCORE);
    await s.load(1);
    s.addMark(1, stroke('a'));
    s.addMark(1, stampAt('p', 0.4, 0.4));
    expect(s.isDirty()).toBe(true);
    await s.commit();
    expect(s.isDirty()).toBe(false);
    const again = createAnnotSession(storage, SCORE);
    await again.load(1);
    expect(again.getMarks(1).map((m) => m.id)).toEqual(['a', 'p']);
  });

  it('commit with no changes writes nothing', async () => {
    let writes = 0;
    const counting: StorageApi = {
      ...storage,
      async setMarks(id, page, marks) {
        writes++;
        return storage.setMarks(id, page, marks);
      },
    };
    const s = createAnnotSession(counting, SCORE);
    await s.commit();
    expect(writes).toBe(0);
  });

  it('commit deletes a page that now has no marks', async () => {
    await storage.setMarks(SCORE, 1, [stroke('a')]);
    const s = createAnnotSession(storage, SCORE);
    await s.load(1);
    s.clearPage(1);
    await s.commit();
    expect(await storage.getMarks(SCORE, 1)).toEqual([]);
    expect(s.isDirty()).toBe(false);
  });

  it('revert drops the changes and restores the committed list', async () => {
    await storage.setMarks(SCORE, 1, [stroke('a')]);
    const s = createAnnotSession(storage, SCORE);
    await s.load(1);
    s.addMark(1, stroke('b'));
    s.eraseAt(1, 0.12, 0.1, 0.01);
    expect(s.isDirty()).toBe(true);
    s.revert();
    expect(s.getMarks(1).map((m) => m.id)).toEqual(['a']);
    expect(s.isDirty()).toBe(false);
    expect(s.canUndo(1)).toBe(false);
    expect(s.canRedo(1)).toBe(false);
  });

  it('isDirty is false after an add that is undone', async () => {
    const s = createAnnotSession(storage, SCORE);
    await s.load(1);
    s.addMark(1, stroke('a'));
    expect(s.isDirty()).toBe(true);
    s.undo(1);
    expect(s.isDirty()).toBe(false);
  });

  it('a mark added while commit is pending stays dirty and is not saved', async () => {
    const gate = gatedStorage(storage);
    const s = createAnnotSession(gate.storage, SCORE);
    await s.load(1);
    s.addMark(1, stroke('a'));
    const pending = s.commit();
    await tick();
    s.addMark(1, stroke('late'));
    gate.finish();
    await pending;
    expect(s.isDirty()).toBe(true);
    const saved = await storage.getMarks(SCORE, 1);
    expect(saved.map((m) => m.id)).toEqual(['a']);
    expect(s.getMarks(1).map((m) => m.id)).toEqual(['a', 'late']);
  });

  it('a failed save rejects commit, keeps the page dirty and keeps the marks in memory', async () => {
    const gate = gatedStorage(storage);
    const s = createAnnotSession(gate.storage, SCORE);
    await s.load(1);
    s.addMark(1, stroke('a'));
    gate.failWith(new Error('disk full'));
    const pending = s.commit();
    await tick();
    gate.finish();
    await expect(pending).rejects.toThrow('disk full');
    expect(s.isDirty()).toBe(true);
    expect(s.getMarks(1).map((m) => m.id)).toEqual(['a']);
    expect(await storage.getMarks(SCORE, 1)).toEqual([]);
  });

  it('two commits at the same time run one after the other', async () => {
    const order: string[] = [];
    const slow: StorageApi = {
      ...storage,
      async setMarks(id, page, marks) {
        order.push(`start ${marks.length}`);
        await new Promise((r) => setTimeout(r, 5));
        await storage.setMarks(id, page, marks);
        order.push(`end ${marks.length}`);
      },
    };
    const s = createAnnotSession(slow, SCORE);
    await s.load(1);
    s.addMark(1, stroke('a'));
    const first = s.commit();
    await tick();
    s.addMark(1, stroke('b'));
    const second = s.commit();
    await Promise.all([first, second]);
    expect(order).toEqual(['start 1', 'end 1', 'start 2', 'end 2']);
    expect(s.isDirty()).toBe(false);
  });

  it('marks added before load finishes are kept', async () => {
    await storage.setMarks(SCORE, 1, [stroke('a')]);
    const s = createAnnotSession(storage, SCORE);
    const loading = s.load(1);
    s.addMark(1, stroke('early'));
    await loading;
    expect(s.getMarks(1).map((m) => m.id)).toEqual(['a', 'early']);
    expect(s.isDirty()).toBe(true);
  });

  it('undo after an early mark never drops saved marks, and commit keeps them (F1a)', async () => {
    await storage.setMarks(SCORE, 1, [stroke('a')]);
    const s = createAnnotSession(storage, SCORE);
    const loading = s.load(1);
    s.addMark(1, stroke('early'));
    await loading;
    s.undo(1);
    expect(s.getMarks(1).map((m) => m.id)).toEqual(['a']);
    s.redo(1);
    expect(s.getMarks(1).map((m) => m.id)).toEqual(['a', 'early']);
    s.undo(1);
    await s.commit();
    expect((await storage.getMarks(SCORE, 1)).map((m) => m.id)).toEqual(['a']);
    expect(s.isDirty()).toBe(false);
  });

  it('clear page before load finishes, then undo, restores saved marks (F1a)', async () => {
    await storage.setMarks(SCORE, 1, [stroke('a')]);
    const s = createAnnotSession(storage, SCORE);
    const loading = s.load(1);
    s.addMark(1, stroke('early'));
    s.clearPage(1);
    await loading;
    s.undo(1);
    s.undo(1);
    expect(s.getMarks(1).map((m) => m.id)).toEqual(['a']);
  });

  it('a page whose load failed is never written; commit reports it; retry works (F1b)', async () => {
    await storage.setMarks(SCORE, 1, [stroke('a')]);
    let failGet = true;
    const flaky: StorageApi = {
      ...storage,
      async getMarks(id, page) {
        if (failGet) throw new Error('read failed');
        return storage.getMarks(id, page);
      },
    };
    const s = createAnnotSession(flaky, SCORE);
    await expect(s.load(1)).rejects.toThrow('read failed');
    s.addMark(1, stroke('new'));
    await expect(s.commit()).rejects.toThrow();
    expect((await storage.getMarks(SCORE, 1)).map((m) => m.id)).toEqual(['a']);
    expect(s.isDirty()).toBe(true);
    // The disk is back: load can be retried and commit then keeps the saved marks.
    failGet = false;
    await s.load(1);
    expect(s.getMarks(1).map((m) => m.id)).toEqual(['a', 'new']);
    await s.commit();
    expect((await storage.getMarks(SCORE, 1)).map((m) => m.id)).toEqual(['a', 'new']);
  });

  it('commit retries a failed load itself and then saves without losing marks (F1b)', async () => {
    await storage.setMarks(SCORE, 1, [stroke('a')]);
    let failGet = true;
    const flaky: StorageApi = {
      ...storage,
      async getMarks(id, page) {
        if (failGet) throw new Error('read failed');
        return storage.getMarks(id, page);
      },
    };
    const s = createAnnotSession(flaky, SCORE);
    await expect(s.load(1)).rejects.toThrow();
    s.addMark(1, stroke('new'));
    failGet = false;
    await s.commit();
    expect((await storage.getMarks(SCORE, 1)).map((m) => m.id)).toEqual(['a', 'new']);
  });

  it('subscribe fires after a commit', async () => {
    const s = createAnnotSession(storage, SCORE);
    await s.load(1);
    s.addMark(1, stroke('a'));
    let calls = 0;
    s.subscribe(() => calls++);
    await s.commit();
    expect(calls).toBeGreaterThan(0);
  });
});
