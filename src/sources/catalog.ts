import type { CatalogEntry, ScoreHit } from '../contracts';
import raw from './catalog.json';

export const CATALOG: CatalogEntry[] = raw as CatalogEntry[];

function toHit(e: CatalogEntry): ScoreHit {
  return {
    id: e.id,
    source: 'catalog',
    title: e.titleUk || e.title,
    composer: e.composerUk || e.composer,
    detail: e.detail,
    license: e.license ?? '',
    pageUrl: e.pageUrl ?? '',
    fileUrl: e.fileUrl,
    sizeBytes: e.sizeBytes,
    pages: e.pages,
  };
}

/** STUB: replaced by package sources-catalog. Simple substring search. */
export function searchCatalog(query: string, limit = 20): ScoreHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return CATALOG.filter((e) =>
    [e.title, e.titleUk, e.composer, e.composerUk, e.detail, ...e.aliases].some((s) => s.toLowerCase().includes(q)),
  )
    .slice(0, limit)
    .map(toHit);
}

/** STUB: replaced by package sources-catalog. */
export function popularCatalog(limit = 12): ScoreHit[] {
  return CATALOG.slice(0, limit).map(toHit);
}
