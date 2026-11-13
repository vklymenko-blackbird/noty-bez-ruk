import {
  AppError, type AppErrorCode, type LibrarySort, type PdfDoc, type ScoreMeta, type ScoreOrigin, type StorageApi,
} from '../contracts';

export interface ImportInfo { fileName?: string; title?: string; composer?: string; detail?: string; origin?: ScoreOrigin }
export interface ImportDeps { storage?: StorageApi; open?: (data: ArrayBuffer) => Promise<PdfDoc>; now?: () => number }
export interface ImportReport { added: ScoreMeta[]; failed: { fileName: string; code: AppErrorCode }[] }

/** STUB: replaced by package import-covers. */
export async function importPdfBytes(_data: ArrayBuffer, _info: ImportInfo, _deps?: ImportDeps): Promise<ScoreMeta> {
  throw new AppError('pdf-open-failed');
}

/** STUB: replaced by package import-covers. */
export async function importFiles(files: File[], _deps?: ImportDeps): Promise<ImportReport> {
  return { added: [], failed: files.map((f) => ({ fileName: f.name, code: 'pdf-open-failed' as const })) };
}

export function titleFromFileName(name: string): string {
  return name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim();
}

/** STUB: replaced by package import-covers. */
export function sortScores(list: ScoreMeta[], sort: LibrarySort): ScoreMeta[] {
  const out = [...list];
  if (sort === 'title') out.sort((a, b) => a.title.localeCompare(b.title, 'uk'));
  else if (sort === 'added') out.sort((a, b) => b.addedAt - a.addedAt);
  else out.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt || b.addedAt - a.addedAt);
  return out;
}
