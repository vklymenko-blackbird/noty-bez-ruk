import { AppError, MAX_DOWNLOAD_BYTES, type LinkOut, type ScoreHit } from '../contracts';
import { t } from '../i18n';

const API_URL = 'https://commons.wikimedia.org/w/api.php';
const UPLOAD_PREFIX = 'https://upload.wikimedia.org/';
const DESCRIPTION_PREFIX = 'https://commons.wikimedia.org/';

type Json = Record<string, unknown>;

function isRecord(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isAbortError(e: unknown): boolean {
  return isRecord(e) && e.name === 'AbortError';
}

/**
 * Strict licence allow-list (SPEC 1.7). NC and ND licences are always refused.
 * Accepted: "Public domain" (any letter case), "PD*", "CC0" (also "CC0 1.0"),
 * "CC BY", "CC BY-SA", and strings that start with "CC BY " or "CC BY-SA ".
 */
export function isAllowedLicense(s: string): boolean {
  const v = s.trim();
  if (v === '') return false;
  if (/\bN[CD]\b/i.test(v)) return false;
  if (v.toLowerCase() === 'public domain') return true;
  if (v.startsWith('PD')) return true;
  if (v === 'CC0' || v.startsWith('CC0 ')) return true;
  return v === 'CC BY' || v === 'CC BY-SA' || v.startsWith('CC BY ') || v.startsWith('CC BY-SA ');
}

/** Turns a raw Commons file title into a readable score title. */
function cleanTitle(raw: string): string {
  let s = raw.startsWith('File:') ? raw.slice('File:'.length) : raw;
  s = s.replace(/\.pdf$/i, '');
  s = s.replace(/^IMSLP\d+-/, '');
  return s.replace(/_/g, ' ').trim();
}

function isImslpTitle(fileTitle: string): boolean {
  return fileTitle.startsWith('IMSLP') || fileTitle.includes('(IA imslp-');
}

interface Candidate {
  index: number;
  imslpFirst: boolean;
  hit: ScoreHit;
}

/** Reads one API page. Returns null when the page is not a usable PDF. */
function toCandidate(key: string, page: unknown): Candidate | null {
  if (!isRecord(page)) return null;
  const infos = page.imageinfo;
  if (!Array.isArray(infos) || !isRecord(infos[0])) return null;
  const info = infos[0];

  if (info.mime !== 'application/pdf') return null;
  const size = info.size;
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0 || size > MAX_DOWNLOAD_BYTES) return null;

  const meta = isRecord(info.extmetadata) ? info.extmetadata : null;
  const licenceField = meta && isRecord(meta.LicenseShortName) ? meta.LicenseShortName.value : undefined;
  if (typeof licenceField !== 'string' || !isAllowedLicense(licenceField)) return null;
  const license = licenceField.trim();

  const url = info.url;
  if (typeof url !== 'string' || !url.startsWith(UPLOAD_PREFIX)) return null;
  const pageUrl = info.descriptionurl;
  if (typeof pageUrl !== 'string' || !pageUrl.startsWith(DESCRIPTION_PREFIX)) return null;

  const rawTitle = typeof page.title === 'string' ? page.title : '';
  const fileTitle = rawTitle.startsWith('File:') ? rawTitle.slice('File:'.length) : rawTitle;
  const pageId = page.pageid !== undefined ? String(page.pageid) : key;
  const pageCount = info.pagecount;
  const index = typeof page.index === 'number' ? page.index : Number.MAX_SAFE_INTEGER;

  return {
    index,
    imslpFirst: isImslpTitle(fileTitle),
    hit: {
      id: `commons:${pageId}`,
      source: 'commons',
      title: cleanTitle(rawTitle),
      composer: '',
      detail: '',
      license,
      pageUrl,
      fileUrl: url,
      sizeBytes: size,
      pages: typeof pageCount === 'number' ? pageCount : null,
    },
  };
}

/**
 * Live search of Wikimedia Commons for PDF scores.
 * Results are plain data. Nothing here renders HTML.
 */
export async function searchCommons(query: string, signal?: AbortSignal): Promise<ScoreHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  if (!navigator.onLine) throw new AppError('offline');

  const url = new URL(API_URL);
  url.searchParams.set('action', 'query');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', `${q} filetype:pdf`);
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', '20');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|size|mime|extmetadata');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');

  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (e) {
    throw isAbortError(e) || signal?.aborted ? new AppError('aborted') : new AppError('network');
  }
  if (!response.ok) throw new AppError('bad-response');

  let data: unknown;
  try {
    data = await response.json();
  } catch (e) {
    throw isAbortError(e) || signal?.aborted ? new AppError('aborted') : new AppError('bad-response');
  }
  if (!isRecord(data)) throw new AppError('bad-response');

  const query_ = data.query;
  if (!isRecord(query_) || !isRecord(query_.pages)) return [];

  const candidates: Candidate[] = [];
  for (const [key, page] of Object.entries(query_.pages)) {
    const c = toCandidate(key, page);
    if (c) candidates.push(c);
  }

  candidates.sort((a, b) => {
    if (a.imslpFirst !== b.imslpFirst) return a.imslpFirst ? -1 : 1;
    return a.index - b.index;
  });
  return candidates.map((c) => c.hit);
}

/** Two external search links (SPEC 1.7 item 5). The query is encoded by URLSearchParams. */
export function linkOuts(query: string): LinkOut[] {
  const q = query.trim();
  const imslp = new URL('https://imslp.org/index.php');
  imslp.searchParams.set('search', q);
  const commons = new URL('https://commons.wikimedia.org/w/index.php');
  commons.searchParams.set('search', `${q} filetype:pdf`);
  commons.searchParams.set('ns6', '1');
  return [
    { id: 'imslp', label: t('search.linkouts.imslp'), url: imslp.toString() },
    { id: 'commons', label: t('search.linkouts.commons'), url: commons.toString() },
  ];
}
