import { describe, expect, it, vi } from 'vitest';
import { AppError, type Mark, type NewScore, type StorageApi } from '../contracts';

const NEW: NewScore = {
  title: 'Для Елізи',
  composer: 'Бетховен',
  pageCount: 3,
  origin: { kind: 'file', sourceName: 'Файл', license: null, pageUrl: null, fileUrl: null },
};
const STROKE: Mark = { kind: 'stroke', id: 'm1', color: 'ink', width: 0.004, points: [0.1, 0.1, 0.2, 0.2] };

function bytes(...n: number[]): ArrayBuffer {
  return new Uint8Array(n).buffer;
}

/** Registers Vitest tests for every StorageApi method. */
export function runStorageContract(name: string, factory: () => StorageApi | Promise<StorageApi>): void {
  describe(`StorageApi contract: ${name}`, () => {
    it('adds, lists and gets a score', async () => {
      const s = await factory();
      expect(await s.listScores()).toEqual([]);
      const meta = await s.addScore(NEW, bytes(1, 2, 3));
      expect(meta.id).toBeTruthy();
      expect(meta.title).toBe('Для Елізи');
      expect(meta.lastPage).toBe(1);
      expect(meta.dividerRatio).toBe(0.5);
      expect(meta.sizeBytes).toBe(3);
      expect((await s.listScores()).map((m) => m.id)).toEqual([meta.id]);
      expect((await s.getScore(meta.id))?.title).toBe('Для Елізи');
      expect(await s.getScore('nope')).toBeNull();
    });

    it('round-trips data as a fresh copy', async () => {
      const s = await factory();
      const meta = await s.addScore(NEW, bytes(9, 8, 7));
      const a = await s.getScoreData(meta.id);
      expect(a).not.toBeNull();
      expect([...new Uint8Array(a as ArrayBuffer)]).toEqual([9, 8, 7]);
      new Uint8Array(a as ArrayBuffer)[0] = 0;
      const b = await s.getScoreData(meta.id);
      expect([...new Uint8Array(b as ArrayBuffer)]).toEqual([9, 8, 7]);
      expect(await s.getScoreData('nope')).toBeNull();
    });

    it('updates with a patch and throws not-found', async () => {
      const s = await factory();
      const meta = await s.addScore(NEW, bytes(1));
      const next = await s.updateScore(meta.id, { lastPage: 2, paper: 'night' });
      expect(next.lastPage).toBe(2);
      expect(next.paper).toBe('night');
      expect(next.title).toBe('Для Елізи');
      expect((await s.getScore(meta.id))?.lastPage).toBe(2);
      await expect(s.updateScore('nope', { lastPage: 1 })).rejects.toMatchObject({ code: 'not-found' });
      await expect(s.updateScore('nope', { lastPage: 1 })).rejects.toBeInstanceOf(AppError);
    });

    it('delete removes meta, file and marks, and ignores unknown ids', async () => {
      const s = await factory();
      const meta = await s.addScore(NEW, bytes(1));
      await s.setMarks(meta.id, 1, [STROKE]);
      await s.deleteScore(meta.id);
      expect(await s.getScore(meta.id)).toBeNull();
      expect(await s.getScoreData(meta.id)).toBeNull();
      expect(await s.getMarks(meta.id, 1)).toEqual([]);
      await expect(s.deleteScore('nope')).resolves.toBeUndefined();
    });

    it('round-trips marks and deletes the record for an empty array', async () => {
      const s = await factory();
      const meta = await s.addScore(NEW, bytes(1));
      expect(await s.getMarks(meta.id, 2)).toEqual([]);
      await s.setMarks(meta.id, 2, [STROKE]);
      expect(await s.getMarks(meta.id, 2)).toEqual([STROKE]);
      expect(await s.getMarks(meta.id, 1)).toEqual([]);
      await s.setMarks(meta.id, 2, []);
      expect(await s.getMarks(meta.id, 2)).toEqual([]);
    });

    it('fires subscribers after add, update and delete', async () => {
      const s = await factory();
      const cb = vi.fn();
      const off = s.subscribe(cb);
      const meta = await s.addScore(NEW, bytes(1));
      await s.updateScore(meta.id, { lastPage: 3 });
      await s.deleteScore(meta.id);
      expect(cb).toHaveBeenCalledTimes(3);
      off();
      await s.addScore(NEW, bytes(1));
      expect(cb).toHaveBeenCalledTimes(3);
    });

    it('returns an estimate with the right shape', async () => {
      const s = await factory();
      const e = await s.estimate();
      expect(e).toHaveProperty('usageBytes');
      expect(e).toHaveProperty('quotaBytes');
      expect(typeof e.persisted).toBe('boolean');
      expect(typeof (await s.requestPersist())).toBe('boolean');
    });
  });
}
