import type { LinkOut, ScoreHit } from '../contracts';
import { t } from '../i18n';

/** STUB: replaced by package sources-commons. */
export async function searchCommons(_query: string, _signal?: AbortSignal): Promise<ScoreHit[]> {
  return [];
}

/** STUB: replaced by package sources-commons. Strict allow-list of licences (SPEC 1.7). */
export function isAllowedLicense(s: string): boolean {
  const v = s.trim();
  if (v === 'Public domain' || v === 'CC0') return true;
  if (v.startsWith('PD')) return true;
  return /^CC BY(-SA)? /.test(v);
}

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
