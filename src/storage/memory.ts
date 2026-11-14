import { AppError, type Mark, type NewScore, type ScoreId, type ScoreMeta, type ScorePatch, type StorageApi } from '../contracts';

let counter = 0;
function makeId(): string {
  counter += 1;
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${counter}`;
  return `s-${rand}`;
}

function copyBuffer(b: ArrayBuffer): ArrayBuffer {
  return b.slice(0);
}

/** A complete in-memory StorageApi. Copies ArrayBuffers and fires subscribers. */
export function createMemoryStorage(): StorageApi {
  const scores = new Map<ScoreId, ScoreMeta>();
  const files = new Map<ScoreId, ArrayBuffer>();
  const marks = new Map<string, Mark[]>();
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((cb) => cb());
  const markKey = (id: ScoreId, page: number) => `${id}:${page}`;

  return {
    async listScores() {
      return [...scores.values()].map((s) => ({ ...s, origin: { ...s.origin } }));
    },
    async getScore(id) {
      const s = scores.get(id);
      return s ? { ...s, origin: { ...s.origin } } : null;
    },
    async getScoreData(id) {
      const f = files.get(id);
      return f ? copyBuffer(f) : null;
    },
    async addScore(input: NewScore, data: ArrayBuffer) {
      const now = Date.now();
      const meta: ScoreMeta = {
        id: makeId(),
        title: input.title,
        composer: input.composer ?? '',
        detail: input.detail ?? '',
        pageCount: input.pageCount,
        sizeBytes: data.byteLength,
        addedAt: now,
        lastOpenedAt: 0,
        lastPage: 1,
        paper: null,
        crop: null,
        dividerRatio: 0.5,
        origin: { ...input.origin },
      };
      scores.set(meta.id, meta);
      files.set(meta.id, copyBuffer(data));
      emit();
      return { ...meta, origin: { ...meta.origin } };
    },
    async updateScore(id, patch: ScorePatch) {
      const cur = scores.get(id);
      if (!cur) throw new AppError('not-found');
      const next: ScoreMeta = { ...cur };
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) (next as unknown as Record<string, unknown>)[k] = v;
      }
      scores.set(id, next);
      emit();
      return { ...next, origin: { ...next.origin } };
    },
    async deleteScore(id) {
      const had = scores.delete(id);
      files.delete(id);
      for (const k of [...marks.keys()]) if (k.startsWith(`${id}:`)) marks.delete(k);
      if (had) emit();
    },
    async getMarks(id, page) {
      const m = marks.get(markKey(id, page));
      return m ? structuredClone(m) : [];
    },
    async setMarks(id, page, list) {
      if (list.length === 0) marks.delete(markKey(id, page));
      else marks.set(markKey(id, page), structuredClone(list));
    },
    async estimate() {
      let used = 0;
      for (const f of files.values()) used += f.byteLength;
      return { usageBytes: used, quotaBytes: null, persisted: false };
    },
    async requestPersist() {
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
