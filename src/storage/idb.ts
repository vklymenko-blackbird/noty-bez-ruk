import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  AppError,
  type Mark,
  type NewScore,
  type ScoreId,
  type ScoreMeta,
  type ScorePatch,
  type StorageApi,
  type StorageEstimate,
} from '../contracts';
import { createMemoryStorage } from './memory';

/** Object stores of the `noty` database, version 1 (SPEC 1.5). */
interface NotySchema extends DBSchema {
  scores: { key: ScoreId; value: ScoreMeta };
  files: { key: ScoreId; value: { id: ScoreId; data: ArrayBuffer } };
  marks: {
    key: string;
    value: { key: string; scoreId: ScoreId; page: number; marks: Mark[] };
    indexes: { byScore: ScoreId };
  };
}

type Db = IDBPDatabase<NotySchema>;

/** Either the real database or the volatile in-memory fallback. */
type Backend = { kind: 'idb'; db: Db } | { kind: 'memory'; mem: StorageApi };

const markKey = (id: ScoreId, page: number): string => `${id}:${page}`;

function copyMeta(m: ScoreMeta): ScoreMeta {
  return { ...m, origin: { ...m.origin } };
}

function isQuotaError(e: unknown): boolean {
  if (e instanceof Error || (typeof DOMException !== 'undefined' && e instanceof DOMException)) {
    return e.name === 'QuotaExceededError';
  }
  return false;
}

/** Maps a quota failure to AppError('storage-full'); other errors pass through. */
function mapError(e: unknown): unknown {
  return isQuotaError(e) ? new AppError('storage-full') : e;
}

/** Rolls back a write transaction. Does nothing when it has already finished. */
function abortQuietly(tx: { abort(): void }): void {
  try {
    tx.abort();
  } catch {
    /* the transaction has already finished */
  }
}

function fallback(reason: unknown): Backend {
  console.warn('Noty storage: IndexedDB is unavailable. Data is kept in memory and is lost on reload.', reason);
  return { kind: 'memory', mem: createMemoryStorage() };
}

async function openBackend(dbName: string): Promise<Backend> {
  if (typeof indexedDB === 'undefined') return fallback('indexedDB is missing');
  try {
    const db = await openDB<NotySchema>(dbName, 1, {
      upgrade(database) {
        database.createObjectStore('scores', { keyPath: 'id' });
        database.createObjectStore('files', { keyPath: 'id' });
        const marks = database.createObjectStore('marks', { keyPath: 'key' });
        marks.createIndex('byScore', 'scoreId');
      },
    });
    return { kind: 'idb', db };
  } catch (e) {
    return fallback(e);
  }
}

/**
 * The IndexedDB implementation of StorageApi. The database opens on the first call.
 * If IndexedDB cannot be used, it falls back to volatile memory and estimate() reports volatile: true.
 */
export function createIdbStorage(dbName = 'noty'): StorageApi {
  const subs = new Set<() => void>();
  const emit = (): void => subs.forEach((cb) => cb());
  let backend: Promise<Backend> | null = null;

  const getBackend = (): Promise<Backend> => {
    if (!backend) backend = openBackend(dbName);
    return backend;
  };

  return {
    async listScores() {
      const b = await getBackend();
      if (b.kind === 'memory') return b.mem.listScores();
      return b.db.getAll('scores');
    },

    async getScore(id) {
      const b = await getBackend();
      if (b.kind === 'memory') return b.mem.getScore(id);
      return (await b.db.get('scores', id)) ?? null;
    },

    async getScoreData(id) {
      const b = await getBackend();
      if (b.kind === 'memory') return b.mem.getScoreData(id);
      const file = await b.db.get('files', id);
      return file ? file.data.slice(0) : null;
    },

    async addScore(input: NewScore, data: ArrayBuffer) {
      const b = await getBackend();
      if (b.kind === 'memory') {
        const meta = await b.mem.addScore(input, data);
        emit();
        return meta;
      }
      const meta: ScoreMeta = {
        id: crypto.randomUUID(),
        title: input.title,
        composer: input.composer ?? '',
        detail: input.detail ?? '',
        pageCount: input.pageCount,
        sizeBytes: data.byteLength,
        addedAt: Date.now(),
        lastOpenedAt: 0,
        lastPage: 1,
        paper: null,
        crop: null,
        dividerRatio: 0.5,
        origin: { ...input.origin },
      };
      const tx = b.db.transaction(['scores', 'files'], 'readwrite');
      tx.done.catch(() => undefined);
      // Both writes join Promise.all, so a failed request never leaves an unhandled rejection.
      // A synchronous throw from the second put becomes a rejection in the microtask.
      const scoreWrite = tx.objectStore('scores').put(meta);
      const fileWrite = Promise.resolve().then(() =>
        tx.objectStore('files').put({ id: meta.id, data: data.slice(0) }),
      );
      try {
        await Promise.all([scoreWrite, fileWrite, tx.done]);
      } catch (e) {
        abortQuietly(tx);
        throw mapError(e);
      }
      emit();
      return copyMeta(meta);
    },

    async updateScore(id, patch: ScorePatch) {
      const b = await getBackend();
      if (b.kind === 'memory') {
        const meta = await b.mem.updateScore(id, patch);
        emit();
        return meta;
      }
      const tx = b.db.transaction('scores', 'readwrite');
      tx.done.catch(() => undefined);
      const store = tx.objectStore('scores');
      const current = await store.get(id);
      if (!current) throw new AppError('not-found');
      const next: ScoreMeta = { ...current };
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) Object.assign(next, { [key]: value });
      }
      try {
        await Promise.all([store.put(next), tx.done]);
      } catch (e) {
        abortQuietly(tx);
        throw mapError(e);
      }
      emit();
      return copyMeta(next);
    },

    async deleteScore(id) {
      const b = await getBackend();
      if (b.kind === 'memory') {
        const existed = (await b.mem.getScore(id)) !== null;
        await b.mem.deleteScore(id);
        if (existed) emit();
        return;
      }
      const tx = b.db.transaction(['scores', 'files', 'marks'], 'readwrite');
      tx.done.catch(() => undefined);
      const existed = (await tx.objectStore('scores').get(id)) !== undefined;
      await tx.objectStore('scores').delete(id);
      await tx.objectStore('files').delete(id);
      const markKeys = await tx.objectStore('marks').index('byScore').getAllKeys(id);
      for (const key of markKeys) await tx.objectStore('marks').delete(key);
      try {
        await tx.done;
      } catch (e) {
        abortQuietly(tx);
        throw e;
      }
      if (existed) emit();
    },

    async getMarks(id, page) {
      const b = await getBackend();
      if (b.kind === 'memory') return b.mem.getMarks(id, page);
      const record = await b.db.get('marks', markKey(id, page));
      return record ? record.marks : [];
    },

    async setMarks(id, page, marks) {
      const b = await getBackend();
      if (b.kind === 'memory') return b.mem.setMarks(id, page, marks);
      const key = markKey(id, page);
      try {
        if (marks.length === 0) await b.db.delete('marks', key);
        else await b.db.put('marks', { key, scoreId: id, page, marks });
      } catch (e) {
        throw mapError(e);
      }
    },

    async estimate(): Promise<StorageEstimate> {
      const b = await getBackend();
      if (b.kind === 'memory') {
        return { ...(await b.mem.estimate()), persisted: false, volatile: true };
      }
      let usageBytes: number | null = null;
      let quotaBytes: number | null = null;
      let persisted = false;
      try {
        if (typeof navigator !== 'undefined' && navigator.storage) {
          if (navigator.storage.estimate) {
            const est = await navigator.storage.estimate();
            usageBytes = est.usage ?? null;
            quotaBytes = est.quota ?? null;
          }
          if (navigator.storage.persisted) persisted = await navigator.storage.persisted();
        }
      } catch {
        /* the storage manager failed: report unknown values */
      }
      return { usageBytes, quotaBytes, persisted, volatile: false };
    },

    async requestPersist() {
      try {
        if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
          return await navigator.storage.persist();
        }
      } catch {
        /* never throws */
      }
      return false;
    },

    subscribe(cb) {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
  };
}
