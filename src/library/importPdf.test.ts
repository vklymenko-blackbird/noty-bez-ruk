import { describe, expect, it, vi } from 'vitest';
import { AppError, MAX_PDF_BYTES, type PdfDoc, type ScoreMeta, type StorageApi } from '../contracts';
import { createMemoryStorage } from '../storage';
import { importFiles, importPdfBytes, sortScores, titleFromFileName } from './importPdf';

const enc = (s: string): ArrayBuffer => new TextEncoder().encode(s).buffer as ArrayBuffer;
const GOOD = (): ArrayBuffer => enc('%PDF-1.4\n% fake test document\n%%EOF');

function fakeDoc(pageCount = 3): PdfDoc {
  return { pageCount, destroy: vi.fn(async () => {}) } as unknown as PdfDoc;
}

function okOpen(pageCount = 3) {
  return vi.fn(async (_data: ArrayBuffer) => fakeDoc(pageCount));
}

function meta(partial: Partial<ScoreMeta> & { id: string; title: string }): ScoreMeta {
  return {
    composer: '', detail: '', pageCount: 1, sizeBytes: 0, addedAt: 0, lastOpenedAt: 0, lastPage: 1,
    paper: null, crop: null, dividerRatio: 0.5,
    origin: { kind: 'file', sourceName: 'Файл', license: null, pageUrl: null, fileUrl: null },
    ...partial,
  };
}

describe('titleFromFileName', () => {
  it.each([
    ['IMSLP11471-Fur_Elise,_Beethoven,_WoO59.pdf', 'Fur Elise, Beethoven, WoO59'],
    ['PMLP12345-Moonlight-Sonata.PDF', 'Moonlight Sonata'],
    ['Clair%20de%20lune.pdf', 'Clair de lune'],
    ['Gymnopedie__No_1.pdf', 'Gymnopedie No 1'],
    ['  spaced   out  .pdf', 'spaced out'],
    ['Bad%E0%A4%A.pdf', 'Bad%E0%A4%A'],
  ])('%s -> %s', (name, expected) => {
    expect(titleFromFileName(name)).toBe(expected);
  });

  it('gives «Без назви» when nothing is left', () => {
    expect(titleFromFileName('.pdf')).toBe('Без назви');
    expect(titleFromFileName('')).toBe('Без назви');
  });
});

describe('importPdfBytes', () => {
  it('stores a good file with the title from the file name', async () => {
    const storage = createMemoryStorage();
    const open = okOpen(5);
    const result = await importPdfBytes(GOOD(), { fileName: 'IMSLP1-Clair_de_lune.pdf' }, { storage, open });
    expect(result.title).toBe('Clair de lune');
    expect(result.pageCount).toBe(5);
    expect(result.origin.kind).toBe('file');
    expect(open).toHaveBeenCalledOnce();
    expect(await storage.getScore(result.id)).not.toBeNull();
  });

  it('uses info.title and info.composer when given', async () => {
    const storage = createMemoryStorage();
    const result = await importPdfBytes(GOOD(), { fileName: 'x.pdf', title: 'Sonata', composer: 'Mozart' }, { storage, open: okOpen() });
    expect(result.title).toBe('Sonata');
    expect(result.composer).toBe('Mozart');
  });

  it('rejects a file that is too large', async () => {
    const big = { byteLength: MAX_PDF_BYTES + 1 } as unknown as ArrayBuffer;
    await expect(importPdfBytes(big, {}, { storage: createMemoryStorage(), open: okOpen() }))
      .rejects.toMatchObject({ code: 'too-large' });
  });

  it('rejects data without the PDF header', async () => {
    await expect(importPdfBytes(enc('just text'), {}, { storage: createMemoryStorage(), open: okOpen() }))
      .rejects.toMatchObject({ code: 'not-pdf' });
  });

  it('rejects a header that is after the first 1024 bytes', async () => {
    const late = enc('x'.repeat(1100) + '%PDF-1.4');
    await expect(importPdfBytes(late, {}, { storage: createMemoryStorage(), open: okOpen() }))
      .rejects.toMatchObject({ code: 'not-pdf' });
  });

  it('accepts a header a few bytes into the file', async () => {
    const shifted = enc('\r\n  %PDF-1.7 body');
    const result = await importPdfBytes(shifted, { fileName: 'a.pdf' }, { storage: createMemoryStorage(), open: okOpen() });
    expect(result.pageCount).toBe(3);
  });

  it('maps an open failure to pdf-open-failed', async () => {
    const open = vi.fn(async () => { throw new Error('broken'); });
    await expect(importPdfBytes(GOOD(), {}, { storage: createMemoryStorage(), open }))
      .rejects.toMatchObject({ code: 'pdf-open-failed' });
  });

  it('rejects a document with no pages', async () => {
    await expect(importPdfBytes(GOOD(), {}, { storage: createMemoryStorage(), open: okOpen(0) }))
      .rejects.toMatchObject({ code: 'pdf-open-failed' });
  });

  it('lets storage-full pass through', async () => {
    const storage: StorageApi = {
      ...createMemoryStorage(),
      addScore: async () => { throw new AppError('storage-full'); },
    };
    await expect(importPdfBytes(GOOD(), {}, { storage, open: okOpen() }))
      .rejects.toMatchObject({ code: 'storage-full' });
  });
});

describe('importFiles', () => {
  function fakeFile(name: string, bytes: ArrayBuffer) {
    return { name, arrayBuffer: async () => bytes } as unknown as File;
  }

  it('imports a good file and reports a bad one', async () => {
    const storage = createMemoryStorage();
    const report = await importFiles(
      [fakeFile('good.pdf', GOOD()), fakeFile('bad.pdf', enc('plain text'))],
      { storage, open: okOpen() },
    );
    expect(report.added).toHaveLength(1);
    expect(report.added[0].title).toBe('good');
    expect(report.failed).toEqual([{ fileName: 'bad.pdf', code: 'not-pdf' }]);
  });

  it('never throws and maps unknown errors to pdf-open-failed', async () => {
    const broken = { name: 'broken.pdf', arrayBuffer: async () => { throw new Error('read failed'); } } as unknown as File;
    const report = await importFiles([broken], { storage: createMemoryStorage(), open: okOpen() });
    expect(report.added).toEqual([]);
    expect(report.failed).toEqual([{ fileName: 'broken.pdf', code: 'pdf-open-failed' }]);
  });
});

describe('sortScores', () => {
  const a = meta({ id: 'a', title: 'Вальс', addedAt: 100, lastOpenedAt: 0 });
  const b = meta({ id: 'b', title: 'Арія', addedAt: 300, lastOpenedAt: 150 });
  const c = meta({ id: 'c', title: 'Бах', addedAt: 200, lastOpenedAt: 900 });
  const input = [a, b, c];

  it('recent: by the later of lastOpenedAt and addedAt, newest first', () => {
    expect(sortScores(input, 'recent').map((s) => s.id)).toEqual(['c', 'b', 'a']);
  });

  it('title: Ukrainian collation', () => {
    expect(sortScores(input, 'title').map((s) => s.title)).toEqual(['Арія', 'Бах', 'Вальс']);
  });

  it('added: addedAt, newest first', () => {
    expect(sortScores(input, 'added').map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('returns a new array and keeps the input order', () => {
    const out = sortScores(input, 'title');
    expect(out).not.toBe(input);
    expect(input.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
});
