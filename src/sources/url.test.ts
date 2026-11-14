import { describe, expect, it } from 'vitest';
import { normalizeFileUrl } from './url';

describe('normalizeFileUrl', () => {
  const base = 'https://upload.wikimedia.org/wikipedia/commons/a/a1/IMSLP11471-Fur_Elise%2C_Beethoven%2C_WoO59.pdf';

  it('removes the query string and the hash', () => {
    expect(normalizeFileUrl(`${base}?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original#top`)).toBe(base);
  });

  it('keeps a clean URL as it is, including the encoded path', () => {
    expect(normalizeFileUrl(base)).toBe(base);
  });

  it('maps null and undefined to null, and keeps a non-URL string', () => {
    expect(normalizeFileUrl(null)).toBeNull();
    expect(normalizeFileUrl(undefined)).toBeNull();
    expect(normalizeFileUrl('not a url')).toBe('not a url');
  });
});
