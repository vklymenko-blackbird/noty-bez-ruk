import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_DOWNLOAD_BYTES, type ScoreHit } from '../contracts';
import { downloadScore } from './download';

const GOOD_URL = 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Sonata_in_C.pdf';

function hit(fileUrl: string | null = GOOD_URL): ScoreHit {
  return {
    id: 'commons:1',
    source: 'commons',
    title: 'Sonata in C',
    composer: '',
    detail: '',
    license: 'Public domain',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:Sonata_in_C.pdf',
    fileUrl,
    sizeBytes: 100,
    pages: 2,
  };
}

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

/** A PDF-like byte array of the given total length, starting with %PDF-. */
function pdfBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  out.set(new TextEncoder().encode('%PDF-1.4\n'));
  for (let i = 9; i < length; i++) out[i] = 0x20;
  return out;
}

/** A body that yields the given chunks one by one. */
function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(chunks[i++]);
      else controller.close();
    },
  });
}

function response(opts: {
  ok?: boolean;
  status?: number;
  headers?: Record<string, string>;
  body?: ReadableStream<Uint8Array> | null;
  buffer?: ArrayBuffer;
}): Response {
  const headers = opts.headers ?? {};
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers: { get: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? null },
    body: opts.body === undefined ? streamOf([]) : opts.body,
    arrayBuffer: async () => opts.buffer ?? new ArrayBuffer(0),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setOnline(true);
});

describe('downloadScore', () => {
  it('downloads a good PDF and reports progress', async () => {
    const bytes = pdfBytes(3000);
    const chunks = [bytes.subarray(0, 1000), bytes.subarray(1000, 2500), bytes.subarray(2500)];
    vi.stubGlobal('fetch', vi.fn(async () => response({ headers: { 'Content-Length': '3000' }, body: streamOf(chunks) })));

    const progress: Array<[number, number | null]> = [];
    const buf = await downloadScore(hit(), (r, t) => progress.push([r, t]));

    expect(buf.byteLength).toBe(3000);
    expect(new Uint8Array(buf)).toEqual(bytes);
    expect(progress).toEqual([
      [1000, 3000],
      [2500, 3000],
      [3000, 3000],
    ]);
  });

  it('passes the signal to fetch', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async () => response({ body: streamOf([pdfBytes(10)]) }));
    vi.stubGlobal('fetch', fetchMock);
    await downloadScore(hit(), undefined, controller.signal);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.signal).toBe(controller.signal);
  });

  it('refuses a non-Wikimedia upload host without a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(downloadScore(hit('https://example.com/a.pdf'))).rejects.toMatchObject({ code: 'bad-response' });
    await expect(downloadScore(hit(null))).rejects.toMatchObject({ code: 'bad-response' });
    await expect(downloadScore(hit('http://upload.wikimedia.org/a.pdf'))).rejects.toMatchObject({ code: 'bad-response' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects offline without a request', async () => {
    setOnline(false);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(downloadScore(hit())).rejects.toMatchObject({ code: 'offline' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps HTTP 404 and 5xx to a network error, not to "not a PDF"', async () => {
    for (const status of [404, 500, 503]) {
      vi.stubGlobal('fetch', vi.fn(async () => response({ ok: false, status })));
      await expect(downloadScore(hit())).rejects.toMatchObject({ code: 'network' });
    }
  });

  it('maps HTTP 429 to its own rate-limited error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ ok: false, status: 429 })));
    await expect(downloadScore(hit())).rejects.toMatchObject({ code: 'rate-limited' });
  });

  it('rejects a file that is not a PDF', async () => {
    const html = new TextEncoder().encode('<html>not a pdf</html>');
    vi.stubGlobal('fetch', vi.fn(async () => response({ body: streamOf([html]) })));
    await expect(downloadScore(hit())).rejects.toMatchObject({ code: 'bad-response' });
  });

  it('rejects a body shorter than the PDF signature', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ body: streamOf([new TextEncoder().encode('%PD')]) })));
    await expect(downloadScore(hit())).rejects.toMatchObject({ code: 'bad-response' });
  });

  it('rejects by Content-Length above the limit without reading the body', async () => {
    const declared = String(MAX_DOWNLOAD_BYTES + 1);
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(pdfBytes(10));
        controller.close();
      },
      cancel,
    });
    vi.stubGlobal('fetch', vi.fn(async () => response({ headers: { 'Content-Length': declared }, body })));
    await expect(downloadScore(hit())).rejects.toMatchObject({ code: 'too-large' });
    expect(cancel).toHaveBeenCalled();
  });

  it('stops while streaming when the body grows above the limit', async () => {
    const half = Math.floor(MAX_DOWNLOAD_BYTES / 2) + 1;
    const first = pdfBytes(half);
    const second = new Uint8Array(half);
    const cancel = vi.fn();
    let i = 0;
    const chunks = [first, second, new Uint8Array(10)];
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i < chunks.length) controller.enqueue(chunks[i++]);
        else controller.close();
      },
      cancel,
    });
    vi.stubGlobal('fetch', vi.fn(async () => response({ body })));
    await expect(downloadScore(hit())).rejects.toMatchObject({ code: 'too-large' });
    expect(cancel).toHaveBeenCalled();
  });

  it('enforces the limit on the arrayBuffer() path', async () => {
    const big = new ArrayBuffer(MAX_DOWNLOAD_BYTES + 1);
    new Uint8Array(big).set(new TextEncoder().encode('%PDF-'));
    vi.stubGlobal('fetch', vi.fn(async () => response({ body: null, buffer: big })));
    await expect(downloadScore(hit())).rejects.toMatchObject({ code: 'too-large' });
  });

  it('accepts a small PDF on the arrayBuffer() path and reports progress once', async () => {
    const bytes = pdfBytes(500);
    const progress = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async () => response({ body: null, buffer: bytes.buffer as ArrayBuffer })));
    const buf = await downloadScore(hit(), progress);
    expect(buf.byteLength).toBe(500);
    expect(progress).toHaveBeenCalledWith(500, null);
  });

  it('maps an abort during fetch to aborted', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn(async () => {
      controller.abort();
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }));
    await expect(downloadScore(hit(), undefined, controller.signal)).rejects.toMatchObject({ code: 'aborted' });
  });

  it('maps a network failure to network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    await expect(downloadScore(hit())).rejects.toMatchObject({ code: 'network' });
  });
});
