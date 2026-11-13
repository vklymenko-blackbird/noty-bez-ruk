import { describe, expect, it } from 'vitest';
import data from './catalog.json';
import type { CatalogEntry } from '../contracts';

const CATALOG = data as CatalogEntry[];

// Licence allow-list of SPEC 1.7 item 3, written inline on purpose.
function licenceAllowed(s: string): boolean {
  return s === 'Public domain' || s.startsWith('PD') || s === 'CC0' || s.startsWith('CC BY ') || s.startsWith('CC BY-SA ');
}

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

  it('resolves at least 40 entries when the network build worked', () => {
    const resolved = CATALOG.filter((e) => e.fileUrl !== null).length;
    if (resolved > 1) {
      expect(resolved).toBeGreaterThanOrEqual(40);
    }
  });
});
