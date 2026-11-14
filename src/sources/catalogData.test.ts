import { describe, expect, it } from 'vitest';
import data from './catalog.json';
import allowRaw from '../../scripts/catalog-verified.json';
import type { CatalogEntry } from '../contracts';
import { popularEntries } from './catalog';

const CATALOG = data as CatalogEntry[];
const allow = allowRaw as { id: string; fileUrl: string; kind: 'piece' | 'set' }[];

// Licence allow-list of SPEC 1.7 item 3, written inline on purpose.
function licenceAllowed(s: string): boolean {
  return s === 'Public domain' || s.startsWith('PD') || s === 'CC0' || s.startsWith('CC BY ') || s.startsWith('CC BY-SA ');
}

describe('catalogue Ukrainian text (C)', () => {
  it('uses «ор.» and never the Russian «соч.»', () => {
    for (const e of CATALOG) {
      expect(e.titleUk, e.id).not.toMatch(/соч\./);
      expect(e.detail, e.id).not.toMatch(/соч\./);
    }
    expect(CATALOG.find((e) => e.id === 'chopin-nocturne-op27-2')?.titleUk).toBe('Ноктюрн ре-бемоль мажор, ор. 27 № 2');
  });

  it('has no Russian-only letters in Ukrainian titles', () => {
    for (const e of CATALOG) {
      expect(e.titleUk, e.id).not.toMatch(/[ыэъё]/i);
      expect(e.composerUk, e.id).not.toMatch(/[ыэъё]/i);
    }
  });

  it('does not repeat the opus of the title in the detail line, and uses one numbering style', () => {
    for (const e of CATALOG) {
      expect(e.detail, e.id).not.toMatch(/\bOp\.|\bNo\. /);
      const first = e.detail.split(';')[0]!.trim();
      if (/№/.test(first)) {
        // The whole numbering may not be a repeat of the title. A shared «№ 3» next to a new «S. 541» is fine.
        expect(first.split(/\s(?=№)/).every((part) => e.titleUk.includes(part)), e.id + ' repeats ' + first).toBe(false);
      }
    }
  });

  it('names a collection in Ukrainian: «у збірці: Вальси, ор. 64»', () => {
    const sets = CATALOG.filter((e) => e.detail.includes('у збірці:'));
    expect(sets.length).toBeGreaterThan(0);
    for (const e of sets) {
      expect(e.detail, e.id).not.toMatch(/Nocturnes|Waltzes|Etudes|Mazurkas|Polonaises|Preludes|Op\./);
    }
    expect(CATALOG.find((e) => e.id === 'chopin-waltz-op64-2')?.detail).toBe('у збірці: Вальси, ор. 64');
  });
});

describe('catalogue data (catalog.json)', () => {
  it('has at least 100 entries', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(100);
  });

  it('has unique ids', () => {
    const ids = new Set(CATALOG.map((e) => e.id));
    expect(ids.size).toBe(CATALOG.length);
  });

  it('every entry has the text fields', () => {
    for (const e of CATALOG) {
      expect(e.title, e.id).toBeTruthy();
      expect(e.titleUk, e.id).toBeTruthy();
      expect(e.composer, e.id).toBeTruthy();
      expect(e.composerUk, e.id).toBeTruthy();
    }
  });

  it('every non-null fileUrl is a Wikimedia upload PDF', () => {
    for (const e of CATALOG) {
      if (e.fileUrl === null) continue;
      expect(e.fileUrl.startsWith('https://upload.wikimedia.org/'), e.id).toBe(true);
      expect(e.fileUrl.toLowerCase().endsWith('.pdf'), e.id).toBe(true);
    }
  });

  it('every non-null pageUrl is a Commons page', () => {
    for (const e of CATALOG) {
      if (e.pageUrl === null) continue;
      expect(e.pageUrl.startsWith('https://commons.wikimedia.org/'), e.id).toBe(true);
    }
  });

  it('every non-null licence passes the allow-list', () => {
    for (const e of CATALOG) {
      if (e.license === null) continue;
      expect(licenceAllowed(e.license), `${e.id}: ${e.license}`).toBe(true);
    }
  });

  it('resolved entries have licence, size and page-url together with the file', () => {
    for (const e of CATALOG) {
      if (e.fileUrl === null) {
        expect(e.license, e.id).toBeNull();
        expect(e.pageUrl, e.id).toBeNull();
        expect(e.sizeBytes, e.id).toBeNull();
      } else {
        expect(e.license, e.id).not.toBeNull();
        expect(e.pageUrl, e.id).not.toBeNull();
        expect(e.sizeBytes, e.id).not.toBeNull();
      }
    }
  });

  it('the Für Elise entry is resolved', () => {
    const fe = CATALOG.find((e) => e.id === 'beethoven-fur-elise');
    expect(fe).toBeDefined();
    expect(fe?.fileUrl).not.toBeNull();
  });

  it('resolves at least 40 entries', () => {
    const resolved = CATALOG.filter((e) => e.fileUrl !== null).length;
    expect(resolved).toBeGreaterThanOrEqual(40);
  });

  it('every resolved entry is in the verified allowlist with the same URL', () => {
    const byId = new Map(allow.map((a) => [a.id, a]));
    for (const e of CATALOG) {
      if (e.fileUrl === null) continue;
      expect(byId.get(e.id)?.fileUrl, e.id).toBe(e.fileUrl);
    }
  });

  it('the allowlist has no duplicate ids and only known ids', () => {
    const ids = new Set(CATALOG.map((e) => e.id));
    expect(new Set(allow.map((a) => a.id)).size).toBe(allow.length);
    for (const a of allow) expect(ids.has(a.id), a.id).toBe(true);
  });

  it('detail says "у збірці" exactly for sets', () => {
    const kind = new Map(allow.map((a) => [a.id, a.kind]));
    for (const e of CATALOG) {
      expect(e.detail.includes('у збірці'), e.id).toBe(e.fileUrl !== null && kind.get(e.id) === 'set');
    }
  });

  it('the old Lustig-Traurig id is gone', () => {
    expect(CATALOG.some((e) => e.id === 'beethoven-bagatelle-woo59')).toBe(false);
    expect(CATALOG.some((e) => e.id === 'beethoven-lustig-traurig-woo54')).toBe(true);
  });

  it('the first 12 popular entries are all resolved', () => {
    const popular = popularEntries(CATALOG, 12);
    expect(popular).toHaveLength(12);
    expect(popular.every((h) => h.fileUrl !== null)).toBe(true);
    expect(popular[0]?.id).toBe('catalog:beethoven-fur-elise');
  });
});
