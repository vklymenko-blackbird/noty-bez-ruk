import type { CatalogEntry, ScoreHit } from '../contracts';
import raw from './catalog.json';

export const CATALOG: CatalogEntry[] = raw as CatalogEntry[];

/**
 * Lower case, drop accents (NFD + combining marks), replace every character
 * that is not a letter or digit with a space, collapse spaces.
 * Works for Latin and Cyrillic. Query and data use the same rules.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function tokensOf(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(' ') : [];
}

interface Haystack {
  title: string[];
  aliases: string[];
  people: string[];
  detail: string[];
}

/** Ukrainian «ор.» (opus) also matches a query typed in Latin as «op». */
function withLatinOpus(text: string): string {
  return text + ' ' + text.replace(/(^|[^\p{L}])ор\./gu, '$1op.');
}

function haystackOf(e: CatalogEntry): Haystack {
  return {
    title: [...tokensOf(e.title), ...tokensOf(withLatinOpus(e.titleUk))],
    aliases: e.aliases.flatMap(tokensOf),
    people: [...tokensOf(e.composer), ...tokensOf(e.composerUk)],
    detail: tokensOf(withLatinOpus(e.detail)),
  };
}

/**
 * Score for one query token: the best category it prefixes.
 * Title 3, aliases 2, composer or detail 1, no match 0 (not a match at all).
 */
function tokenScore(qt: string, h: Haystack): number {
  const hits = (list: string[]) => list.some((t) => t.startsWith(qt));
  if (hits(h.title)) return 3;
  if (hits(h.aliases)) return 2;
  if (hits(h.people) || hits(h.detail)) return 1;
  return 0;
}

function toHit(e: CatalogEntry): ScoreHit {
  const commonsSearch = new URL('https://commons.wikimedia.org/w/index.php');
  commonsSearch.searchParams.set('search', `${e.title} filetype:pdf`);
  commonsSearch.searchParams.set('ns6', '1');
  return {
    id: 'catalog:' + e.id,
    source: 'catalog',
    title: e.titleUk || e.title,
    composer: e.composerUk || e.composer,
    detail: e.detail,
    license: e.license ?? '',
    pageUrl: e.pageUrl ?? commonsSearch.toString(),
    fileUrl: e.fileUrl,
    sizeBytes: e.sizeBytes,
    pages: e.pages,
  };
}

/**
 * Pure search. Every query token must be a prefix of some token of the entry.
 * Score: per query token, the best category (title/titleUk 3, aliases 2,
 * composer/composerUk/detail 1). Order: resolved entries first, then score,
 * then catalogue order.
 */
export function searchEntries(entries: CatalogEntry[], query: string, limit = 20): ScoreHit[] {
  const qTokens = tokensOf(query);
  if (qTokens.length === 0) return [];

  const ranked: { e: CatalogEntry; score: number; index: number }[] = [];
  entries.forEach((e, index) => {
    const h = haystackOf(e);
    let score = 0;
    for (const qt of qTokens) {
      const s = tokenScore(qt, h);
      if (s === 0) return;
      score += s;
    }
    ranked.push({ e, score, index });
  });

  ranked.sort((a, b) => {
    const ra = a.e.fileUrl === null ? 1 : 0;
    const rb = b.e.fileUrl === null ? 1 : 0;
    if (ra !== rb) return ra - rb;
    if (a.score !== b.score) return b.score - a.score;
    return a.index - b.index;
  });

  return ranked.slice(0, limit).map((r) => toHit(r.e));
}

/** Pure. The first resolved entries in catalogue order. */
export function popularEntries(entries: CatalogEntry[], limit = 12): ScoreHit[] {
  return entries
    .filter((e) => e.fileUrl !== null)
    .slice(0, limit)
    .map(toHit);
}

export function searchCatalog(query: string, limit = 20): ScoreHit[] {
  return searchEntries(CATALOG, query, limit);
}

export function popularCatalog(limit = 12): ScoreHit[] {
  return popularEntries(CATALOG, limit);
}
