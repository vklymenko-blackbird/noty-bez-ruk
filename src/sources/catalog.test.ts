import { describe, expect, it } from 'vitest';
import type { CatalogEntry } from '../contracts';
import { CATALOG, normalize, popularCatalog, popularEntries, searchCatalog, searchEntries } from './catalog';

const PD = 'Public domain';
const URL_BASE = 'https://upload.wikimedia.org/wikipedia/commons/x/';

function entry(over: Partial<CatalogEntry> & { id: string }): CatalogEntry {
  return {
    title: '',
    titleUk: '',
    aliases: [],
    composer: '',
    composerUk: '',
    detail: '',
    fileUrl: URL_BASE + over.id + '.pdf',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:' + over.id + '.pdf',
    license: PD,
    sizeBytes: 1000,
    pages: 4,
    ...over,
  };
}

const MOONLIGHT = entry({
  id: 'beethoven-moonlight',
  title: 'Moonlight Sonata',
  titleUk: 'Місячна соната',
  aliases: ['Sonata quasi una fantasia', 'Mondschein-Sonate'],
  composer: 'Ludwig van Beethoven',
  composerUk: 'Людвіг ван Бетховен',
  detail: 'Op. 27 No. 2',
});

const FUR_ELISE = entry({
  id: 'beethoven-fur-elise',
  title: 'Für Elise',
  titleUk: 'До Елізи',
  aliases: ['Fur Elise', 'For Elise', 'Bagatelle No. 25', 'Елізі'],
  composer: 'Ludwig van Beethoven',
  composerUk: 'Людвіг ван Бетховен',
  detail: 'WoO 59',
});

const NOCTURNE_OP9 = entry({
  id: 'chopin-nocturne-op9-2',
  title: 'Nocturne Op. 9 No. 2',
  titleUk: 'Ноктюрн мі-бемоль мажор',
  aliases: ['Nocturne in E-flat major'],
  composer: 'Frédéric Chopin',
  composerUk: 'Фредерик Шопен',
  detail: 'Op. 9 No. 2',
});

// Unresolved: no file, so it must sort after resolved entries.
const NOCTURNE_OP27 = entry({
  id: 'chopin-nocturne-op27-2',
  title: 'Nocturne Op. 27 No. 2',
  titleUk: 'Ноктюрн ре-бемоль мажор',
  composer: 'Frédéric Chopin',
  composerUk: 'Фредерик Шопен',
  detail: 'Op. 27 No. 2',
  fileUrl: null,
  pageUrl: null,
  license: null,
  sizeBytes: null,
  pages: null,
});

const NOCTURNE_OP48 = entry({
  id: 'chopin-nocturne-op48-1',
  title: 'Nocturne Op. 48 No. 1',
  titleUk: 'Ноктюрн до мінор',
  composer: 'Frédéric Chopin',
  composerUk: 'Фредерик Шопен',
  detail: 'Op. 48 No. 1',
});

const CLAIR_DE_LUNE = entry({
  id: 'debussy-clair-de-lune',
  title: 'Clair de Lune',
  titleUk: 'Місячне світло',
  aliases: ['Moonlight'],
  composer: 'Claude Debussy',
  composerUk: 'Клод Дебюссі',
  detail: '',
  fileUrl: null,
  pageUrl: null,
  license: null,
  sizeBytes: null,
  pages: null,
});

const PRELUDE_C = entry({
  id: 'bach-prelude-c',
  title: 'Prelude in C major',
  titleUk: 'Прелюдія до мажор',
  composer: 'Johann Sebastian Bach',
  composerUk: 'Йоганн Себастьян Бах',
  detail: 'BWV 846',
});

const TURKISH = entry({
  id: 'mozart-rondo-turca',
  title: 'Rondo alla Turca',
  titleUk: 'Рондо в турецькому стилі',
  aliases: ['Turkish March'],
  composer: 'Wolfgang Amadeus Mozart',
  composerUk: 'Вольфганг Амадей Моцарт',
  detail: 'K. 331',
});

const SAMPLE: CatalogEntry[] = [
  MOONLIGHT,
  FUR_ELISE,
  NOCTURNE_OP9,
  NOCTURNE_OP27,
  NOCTURNE_OP48,
  CLAIR_DE_LUNE,
  PRELUDE_C,
  TURKISH,
];

function ids(hits: { id: string }[]): string[] {
  return hits.map((h) => h.id);
}

describe('normalize', () => {
  it('lower-cases and drops accents for Latin text', () => {
    expect(normalize('Für Elise')).toBe('fur elise');
  });

  it('keeps Ukrainian letters and folds ї to і', () => {
    expect(normalize('Їжак')).toBe('іжак');
    expect(normalize('Місячна соната')).toBe('місячна соната');
  });

  it('replaces punctuation with spaces and collapses spaces', () => {
    expect(normalize('  Hello,   World!  ')).toBe('hello world');
  });
});

describe('searchEntries', () => {
  it('finds Moonlight Sonata by its English title', () => {
    expect(ids(searchEntries(SAMPLE, 'moonlight'))[0]).toBe('catalog:beethoven-moonlight');
  });

  it('finds Moonlight Sonata by its Ukrainian title, with and without the full phrase', () => {
    expect(ids(searchEntries(SAMPLE, 'місячна'))[0]).toBe('catalog:beethoven-moonlight');
    expect(ids(searchEntries(SAMPLE, 'Місячна соната'))[0]).toBe('catalog:beethoven-moonlight');
  });

  it('finds Für Elise by every spelling', () => {
    for (const q of ['elise', 'до елізи', 'fur elise', 'für elise']) {
      expect(ids(searchEntries(SAMPLE, q))[0]).toBe('catalog:beethoven-fur-elise');
    }
  });

  it('finds Chopin nocturnes by Ukrainian and by Latin words', () => {
    const uk = ids(searchEntries(SAMPLE, 'шопен ноктюрн'));
    expect(uk.slice(0, 2)).toEqual(['catalog:chopin-nocturne-op9-2', 'catalog:chopin-nocturne-op48-1']);
    const lat = ids(searchEntries(SAMPLE, 'chopin noct'));
    expect(lat).toContain('catalog:chopin-nocturne-op27-2');
    expect(lat[0]).toBe('catalog:chopin-nocturne-op9-2');
  });

  it('returns nothing for an unknown query', () => {
    expect(searchEntries(SAMPLE, 'xyzxyz')).toEqual([]);
  });

  it('returns nothing for an empty or symbol-only query', () => {
    expect(searchEntries(SAMPLE, '')).toEqual([]);
    expect(searchEntries(SAMPLE, '   ')).toEqual([]);
    expect(searchEntries(SAMPLE, '!!!')).toEqual([]);
  });

  it('requires every query token to match', () => {
    expect(searchEntries(SAMPLE, 'moonlight xyzxyz')).toEqual([]);
  });

  it('puts resolved entries before unresolved ones', () => {
    const hits = ids(searchEntries(SAMPLE, 'ноктюрн'));
    expect(hits).toEqual([
      'catalog:chopin-nocturne-op9-2',
      'catalog:chopin-nocturne-op48-1',
      'catalog:chopin-nocturne-op27-2',
    ]);
  });

  it('ranks a title match above a composer-only match', () => {
    const composerOnly = entry({ id: 'a', title: 'Waltz', titleUk: 'Вальс', composer: 'Chopin', composerUk: 'Шопен' });
    const titleMatch = entry({ id: 'b', title: 'Chopin Study', titleUk: 'Етюд', composer: 'Someone' });
    const hits = ids(searchEntries([composerOnly, titleMatch], 'chopin'));
    expect(hits).toEqual(['catalog:b', 'catalog:a']);
  });

  it('keeps catalogue order for equal scores', () => {
    const first = entry({ id: 'first', title: 'Etude', composer: 'Liszt' });
    const second = entry({ id: 'second', title: 'Etude', composer: 'Liszt' });
    expect(ids(searchEntries([first, second], 'etude'))).toEqual(['catalog:first', 'catalog:second']);
  });

  it('applies the limit', () => {
    expect(searchEntries(SAMPLE, 'ноктюрн', 2)).toHaveLength(2);
    expect(searchEntries(SAMPLE, 'ноктюрн', 1)[0].id).toBe('catalog:chopin-nocturne-op9-2');
  });

  it('default limit is 20', () => {
    const many = Array.from({ length: 25 }, (_, i) => entry({ id: 'e' + i, title: 'Etude ' + i }));
    expect(searchEntries(many, 'etude')).toHaveLength(20);
  });
});

describe('popularEntries', () => {
  it('skips unresolved entries and keeps catalogue order', () => {
    const hits = ids(popularEntries(SAMPLE, 12));
    expect(hits).not.toContain('catalog:debussy-clair-de-lune');
    expect(hits).not.toContain('catalog:chopin-nocturne-op27-2');
    expect(hits[0]).toBe('catalog:beethoven-moonlight');
  });

  it('applies the limit', () => {
    expect(ids(popularEntries(SAMPLE, 2))).toEqual(['catalog:beethoven-moonlight', 'catalog:beethoven-fur-elise']);
  });
});

describe('ScoreHit mapping', () => {
  it('maps a resolved entry to a catalog hit with the Ukrainian title', () => {
    const [hit] = searchEntries([MOONLIGHT], 'moonlight');
    expect(hit).toEqual({
      id: 'catalog:beethoven-moonlight',
      source: 'catalog',
      title: 'Місячна соната',
      composer: 'Людвіг ван Бетховен',
      detail: 'Op. 27 No. 2',
      license: PD,
      pageUrl: MOONLIGHT.pageUrl,
      fileUrl: MOONLIGHT.fileUrl,
      sizeBytes: 1000,
      pages: 4,
    });
  });

  it('uses an empty licence when the entry has none', () => {
    const [hit] = searchEntries([entry({ id: 'x', title: 'Gavotte', license: null })], 'gavotte');
    expect(hit.license).toBe('');
  });

  it('keeps fileUrl null and builds a Commons search link when pageUrl is missing', () => {
    const [hit] = searchEntries([NOCTURNE_OP27], 'nocturne');
    expect(hit.fileUrl).toBeNull();
    expect(hit.pageUrl.startsWith('https://commons.wikimedia.org/w/index.php?')).toBe(true);
    expect(hit.pageUrl).toContain('ns6=1');
  });
});

describe('searchCatalog and popularCatalog on the real catalogue', () => {
  it('finds Für Elise by Latin and Ukrainian title with a Wikimedia file', () => {
    for (const q of ['elise', 'до елізи']) {
      const [hit] = searchCatalog(q);
      expect(hit.id).toBe('catalog:beethoven-fur-elise');
      expect(hit.fileUrl).toMatch(/^https:\/\/upload\.wikimedia\.org\//);
    }
  });

  it('returns nothing for an empty query', () => {
    expect(searchCatalog('')).toEqual([]);
  });

  it('popularCatalog returns only resolved entries', () => {
    const hits = popularCatalog();
    expect(hits.every((h) => h.fileUrl !== null)).toBe(true);
    expect(hits.length).toBe(CATALOG.filter((e) => e.fileUrl !== null).length);
  });
});
