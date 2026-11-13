import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError, type Mark, type NewScore } from '../contracts';
import { runStorageContract } from './contractSuite';
import { createIdbStorage } from './idb';

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

function uniqueName(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2)}`;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

runStorageContract('idb', () => createIdbStorage(uniqueName('test')));

describe('createIdbStorage', () => {
  it('keeps scores, bytes and marks across instances with the same database name', async () => {
    const name = uniqueName('persist');
    const first = createIdbStorage(name);
    const meta = await first.addScore(NEW, bytes(1, 2, 3));
    await first.setMarks(meta.id, 2, [STROKE]);

    const second = createIdbStorage(name);
    expect((await second.getScore(meta.id))?.title).toBe('Для Елізи');
    const data = await second.getScoreData(meta.id);
    expect(data && Array.from(new Uint8Array(data))).toEqual([1, 2, 3]);
    expect(await second.getMarks(meta.id, 2)).toEqual([STROKE]);
  });

  it('throws storage-full and keeps no partial record when the file write hits the quota', async () => {
    const storage = createIdbStorage(uniqueName('quota'));
    await storage.listScores();

    const realPut = IDBObjectStore.prototype.put;
    const quota = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (this.name === 'files') throw quota;
      return realPut.call(this, value, key);
    });

    await expect(storage.addScore(NEW, bytes(1, 2, 3))).rejects.toMatchObject({ code: 'storage-full' });
    await expect(storage.addScore(NEW, bytes(1))).rejects.toBeInstanceOf(AppError);
    vi.restoreAllMocks();
    expect(await storage.listScores()).toEqual([]);
  });

  it('falls back to volatile memory when indexedDB is missing', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const storage = createIdbStorage(uniqueName('fallback'));
    const meta = await storage.addScore(NEW, bytes(1, 2, 3));
    expect((await storage.listScores()).map((m) => m.id)).toEqual([meta.id]);
    expect(await storage.getScoreData(meta.id)).not.toBeNull();
    expect((await storage.estimate()).volatile).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('reports volatile false when the normal IndexedDB is used', async () => {
    const storage = createIdbStorage(uniqueName('normal'));
    expect((await storage.estimate()).volatile).toBe(false);
  });
});
