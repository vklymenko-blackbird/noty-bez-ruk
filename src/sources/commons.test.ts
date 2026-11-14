import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError, MAX_DOWNLOAD_BYTES } from '../contracts';
import { isAllowedLicense, linkOuts, searchCommons } from './commons';

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

function filePage(over: Record<string, unknown> = {}, pageOver: Record<string, unknown> = {}) {
  return {
    pageid: 1,
    ns: 6,
    title: 'File:Sonata_in_C.pdf',
    index: 1,
    imageinfo: [
      {
        url: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Sonata_in_C.pdf',
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Sonata_in_C.pdf',
        size: 100000,
        mime: 'application/pdf',
        pagecount: 12,
        extmetadata: { LicenseShortName: { value: 'Public domain' } },
        ...over,
      },
    ],
    ...pageOver,
  };
}

function pagesResponse(pages: Record<string, unknown>): Response {
  return jsonResponse({ query: { pages } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setOnline(true);
});

describe('isAllowedLicense', () => {
  it.each([
    ['Public domain', true],
    ['public domain', true],
    ['PUBLIC DOMAIN', true],
    ['PD-old-auto-expire', true],
    ['PD-US', true],
    ['CC0', true],
    ['CC0 1.0', true],
    ['CC BY 4.0', true],
    ['CC BY-SA 3.0', true],
    ['CC BY', true],
    ['CC BY-SA', true],
    ['  CC BY-SA 4.0  ', true],
    ['CC BY-NC 4.0', false],
    ['CC BY-NC-SA 4.0', false],
    ['CC BY-ND 4.0', false],
    ['CC BY-NC-ND 4.0', false],
    ['CC BY-SA-NC', false],
    ['All rights reserved', false],
    ['GFDL', false],
    ['', false],
    ['   ', false],
  ])('%j -> %s', (licence, expected) => {
    expect(isAllowedLicense(licence)).toBe(expected);
  });
});

describe('searchCommons', () => {
  it('resolves [] for a query under 2 characters without a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await searchCommons(' a ')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('builds the API URL with the required parameters', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    await searchCommons('  Für Elise ');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    const u = new URL(String(url));
    expect(u.origin + u.pathname).toBe('https://commons.wikimedia.org/w/api.php');
    expect(u.searchParams.get('action')).toBe('query');
    expect(u.searchParams.get('generator')).toBe('search');
    expect(u.searchParams.get('gsrsearch')).toBe('Für Elise filetype:pdf');
    expect(u.searchParams.get('gsrnamespace')).toBe('6');
    expect(u.searchParams.get('gsrlimit')).toBe('20');
    expect(u.searchParams.get('prop')).toBe('imageinfo');
    expect(u.searchParams.get('iiprop')).toBe('url|size|mime|extmetadata');
    expect(u.searchParams.get('format')).toBe('json');
    expect(u.searchParams.get('origin')).toBe('*');
    expect(init.headers).toBeUndefined();
  });

  it('keeps a good PDF and maps it to a ScoreHit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => pagesResponse({ '1': filePage() })));
    const hits = await searchCommons('sonata');
    expect(hits).toEqual([
      {
        id: 'commons:1',
        source: 'commons',
        title: 'Sonata in C',
        composer: '',
        detail: '',
        license: 'Public domain',
        pageUrl: 'https://commons.wikimedia.org/wiki/File:Sonata_in_C.pdf',
        fileUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Sonata_in_C.pdf',
        sizeBytes: 100000,
        pages: 12,
      },
    ]);
  });

  it('drops the utm query string from the file URL', async () => {
    const page = filePage({
      url: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Sonata_in_C.pdf?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original#x',
    });
    vi.stubGlobal('fetch', vi.fn(async () => pagesResponse({ '1': page })));
    const hits = await searchCommons('sonata');
    expect(hits[0].fileUrl).toBe('https://upload.wikimedia.org/wikipedia/commons/a/a1/Sonata_in_C.pdf');
  });

  it('returns [] when the response has no query key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ batchcomplete: '' })));
    expect(await searchCommons('sonata')).toEqual([]);
  });

  it('returns [] when query has no pages object', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ query: {} })));
    expect(await searchCommons('sonata')).toEqual([]);
  });

  it('filters by mime type', async () => {
    const page = filePage({ mime: 'image/jpeg' });
    vi.stubGlobal('fetch', vi.fn(async () => pagesResponse({ '1': page })));
    expect(await searchCommons('sonata')).toEqual([]);
  });

  it('filters by size above the download limit', async () => {
    const page = filePage({ size: MAX_DOWNLOAD_BYTES + 1 });
    vi.stubGlobal('fetch', vi.fn(async () => pagesResponse({ '1': page })));
    expect(await searchCommons('sonata')).toEqual([]);
  });

  it('keeps a file exactly at the size limit', async () => {
    const page = filePage({ size: MAX_DOWNLOAD_BYTES });
    vi.stubGlobal('fetch', vi.fn(async () => pagesResponse({ '1': page })));
    expect(await searchCommons('sonata')).toHaveLength(1);
  });

  it('filters by licence', async () => {
    const page = filePage({ extmetadata: { LicenseShortName: { value: 'CC BY-NC 4.0' } } });
    vi.stubGlobal('fetch', vi.fn(async () => pagesResponse({ '1': page })));
    expect(await searchCommons('sonata')).toEqual([]);
  });

  it('filters when the licence field is missing', async () => {
    const page = filePage({ extmetadata: {} });
    vi.stubGlobal('fetch', vi.fn(async () => pagesResponse({ '1': page })));
    expect(await searchCommons('sonata')).toEqual([]);
  });

  it('filters by the file host', async () => {
    const page = filePage({ url: 'https://example.com/Sonata.pdf' });
    vi.stubGlobal('fetch', vi.fn(async () => pagesResponse({ '1': page })));
    expect(await searchCommons('sonata')).toEqual([]);
  });

  it('filters by the description host', async () => {
    const page = filePage({ descriptionurl: 'https://evil.example.com/File:Sonata.pdf' });
    vi.stubGlobal('fetch', vi.fn(async () => pagesResponse({ '1': page })));
    expect(await searchCommons('sonata')).toEqual([]);
  });

  it('drops a page with no imageinfo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => pagesResponse({ '1': { pageid: 1, title: 'File:X.pdf' } })));
    expect(await searchCommons('sonata')).toEqual([]);
  });

  it('cleans titles: File: prefix, .pdf ending, IMSLP prefix, underscores', async () => {
    const pages = {
      '1': filePage({}, { title: 'File:IMSLP12345-Piano_Sonata_No._14_(Beethoven).pdf', index: 1 }),
      '2': filePage({}, { pageid: 2, title: 'File:Nocturne_Op.9.PDF', index: 2 }),
    };
    vi.stubGlobal('fetch', vi.fn(async () => pagesResponse(pages)));
    const titles = (await searchCommons('sonata')).map((h) => h.title);
    expect(titles).toEqual(['Piano Sonata No. 14 (Beethoven)', 'Nocturne Op.9']);
  });

  it('puts IMSLP titles first, then by search index', async () => {
    const pages = {
      '1': filePage({}, { pageid: 1, title: 'File:Other_sonata.pdf', index: 1 }),
      '2': filePage({}, { pageid: 2, title: 'File:Zeta_sonata.pdf', index: 2 }),
      '3': filePage({}, { pageid: 3, title: 'File:IMSLP999-Late.pdf', index: 3 }),
      '4': filePage({}, { pageid: 4, title: 'File:Mid (IA imslp-x) sonata.pdf', index: 4 }),
    };
    vi.stubGlobal('fetch', vi.fn(async () => pagesResponse(pages)));
    const ids = (await searchCommons('sonata')).map((h) => h.id);
    expect(ids).toEqual(['commons:3', 'commons:4', 'commons:1', 'commons:2']);
  });

  it('uses null pages when pagecount is missing', async () => {
    const page = filePage();
    (page.imageinfo[0] as Record<string, unknown>).pagecount = undefined;
    vi.stubGlobal('fetch', vi.fn(async () => pagesResponse({ '1': page })));
    expect((await searchCommons('sonata'))[0].pages).toBeNull();
  });

  it('rejects AppError offline without a request', async () => {
    setOnline(false);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(searchCommons('sonata')).rejects.toMatchObject({ code: 'offline' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps HTTP 500 to bad-response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, false, 500)));
    await expect(searchCommons('sonata')).rejects.toBeInstanceOf(AppError);
    await expect(searchCommons('sonata')).rejects.toMatchObject({ code: 'bad-response' });
  });

  it('maps bad JSON to bad-response', async () => {
    const broken = {
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    } as unknown as Response;
    vi.stubGlobal('fetch', vi.fn(async () => broken));
    await expect(searchCommons('sonata')).rejects.toMatchObject({ code: 'bad-response' });
  });

  it('maps a network failure to network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    await expect(searchCommons('sonata')).rejects.toMatchObject({ code: 'network' });
  });

  it('maps an abort to aborted', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn(async (_u: unknown, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      controller.abort();
      throw Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
    }));
    await expect(searchCommons('sonata', controller.signal)).rejects.toMatchObject({ code: 'aborted' });
  });
});

describe('linkOuts', () => {
  it('returns the IMSLP and Commons links with encoded queries', () => {
    const [imslp, commons] = linkOuts('  Für Elise  ');
    expect(imslp.id).toBe('imslp');
    expect(commons.id).toBe('commons');

    const i = new URL(imslp.url);
    expect(i.origin).toBe('https://imslp.org');
    expect(i.searchParams.get('search')).toBe('Für Elise');

    const c = new URL(commons.url);
    expect(c.origin).toBe('https://commons.wikimedia.org');
    expect(c.pathname).toBe('/w/index.php');
    expect(c.searchParams.get('search')).toBe('Für Elise filetype:pdf');
    expect(c.searchParams.get('ns6')).toBe('1');
    expect(commons.url).toContain('ns6=1');
  });

  it('encodes a Ukrainian query in the URL', () => {
    const [imslp] = linkOuts('Місячна соната');
    expect(imslp.url).not.toContain('Місячна');
    expect(new URL(imslp.url).searchParams.get('search')).toBe('Місячна соната');
  });

  it('has labels from the string table', () => {
    const links = linkOuts('sonata');
    expect(links.every((l) => l.label.length > 0)).toBe(true);
  });
});
