import {
  AppError, MAX_PDF_BYTES, type AppErrorCode, type LibrarySort, type PdfDoc, type ScoreMeta, type ScoreOrigin, type StorageApi,
} from '../contracts';
import { storage as defaultStorage } from '../storage';
import { openPdf } from '../pdf';
import { t } from '../i18n';

export interface ImportInfo { fileName?: string; title?: string; composer?: string; detail?: string; origin?: ScoreOrigin }
export interface ImportDeps { storage?: StorageApi; open?: (data: ArrayBuffer) => Promise<PdfDoc>; now?: () => number }
export interface ImportReport { added: ScoreMeta[]; failed: { fileName: string; code: AppErrorCode }[] }

/** Only the first bytes are searched. Real files can have a few bytes before the header. */
const HEADER_WINDOW = 1024;
const PDF_MAGIC = '%PDF-';
const UNTITLED = 'Без назви';

/** Returns true when the file starts with the PDF header (within the first 1024 bytes). */
function hasPdfHeader(data: ArrayBuffer): boolean {
  const bytes = new Uint8Array(data, 0, Math.min(HEADER_WINDOW, data.byteLength));
  const magic = [...PDF_MAGIC].map((ch) => ch.charCodeAt(0));
  for (let start = 0; start + magic.length <= bytes.length; start += 1) {
    let match = true;
    for (let i = 0; i < magic.length; i += 1) {
      if (bytes[start + i] !== magic[i]) { match = false; break; }
    }
    if (match) return true;
  }
  return false;
}

/** Makes a readable title from a file name. Empty results become «Без назви». */
export function titleFromFileName(name: string): string {
  let s = name.replace(/\.pdf$/i, '');
  s = s.replace(/^(IMSLP|PMLP)\d+-/i, '');
  try {
    s = decodeURIComponent(s);
  } catch {
    /* keep the raw name when it is not valid percent-encoding */
  }
  s = s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s === '' ? UNTITLED : s;
}

/**
 * Validates the bytes, reads the page count, and stores the score.
 * Throws AppError: 'too-large', 'not-pdf', 'pdf-open-failed', or 'storage-full' (from storage).
 */
export async function importPdfBytes(data: ArrayBuffer, info: ImportInfo, deps: ImportDeps = {}): Promise<ScoreMeta> {
  const storage = deps.storage ?? defaultStorage;
  const open = deps.open ?? openPdf;

  if (data.byteLength > MAX_PDF_BYTES) throw new AppError('too-large');
  if (!hasPdfHeader(data)) throw new AppError('not-pdf');

  let pageCount: number;
  try {
    const doc = await open(data);
    pageCount = doc.pageCount;
    await doc.destroy();
  } catch {
    throw new AppError('pdf-open-failed');
  }
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new AppError('pdf-open-failed');

  const title = info.title?.trim() || titleFromFileName(info.fileName ?? '');
  const origin: ScoreOrigin = info.origin ?? {
    kind: 'file', sourceName: t('score.source.file'), license: null, pageUrl: null, fileUrl: null,
  };

  const meta = await storage.addScore(
    { title, composer: info.composer ?? '', detail: info.detail ?? '', pageCount, origin },
    data,
  );

  // Ask for persistent storage, but never wait for the answer or fail on it.
  try {
    void storage.requestPersist().catch(() => false);
  } catch {
    /* ignore */
  }
  return meta;
}

function codeOf(err: unknown): AppErrorCode {
  return err instanceof AppError ? err.code : 'pdf-open-failed';
}

/** Imports files one after another. Never throws; failures go into the report. */
export async function importFiles(files: File[], deps?: ImportDeps): Promise<ImportReport> {
  const added: ScoreMeta[] = [];
  const failed: ImportReport['failed'] = [];
  for (const file of files) {
    try {
      const data = await file.arrayBuffer();
      added.push(await importPdfBytes(data, { fileName: file.name }, deps));
    } catch (err) {
      failed.push({ fileName: file.name, code: codeOf(err) });
    }
  }
  return { added, failed };
}

/** Returns a new sorted array. The input is not changed. */
export function sortScores(list: ScoreMeta[], sort: LibrarySort): ScoreMeta[] {
  const out = [...list];
  if (sort === 'title') {
    out.sort((a, b) => a.title.localeCompare(b.title, 'uk'));
  } else if (sort === 'added') {
    out.sort((a, b) => b.addedAt - a.addedAt);
  } else {
    const key = (s: ScoreMeta) => Math.max(s.lastOpenedAt, s.addedAt);
    out.sort((a, b) => key(b) - key(a));
  }
  return out;
}
