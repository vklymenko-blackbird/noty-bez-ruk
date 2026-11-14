import { AppError, MAX_DOWNLOAD_BYTES, type DownloadProgress, type ScoreHit } from '../contracts';

const UPLOAD_PREFIX = 'https://upload.wikimedia.org/';
const PDF_MAGIC = '%PDF-';

function isAbortError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError';
}

/** Maps any unknown failure to an AppError code. AppError passes through unchanged. */
function toAppError(e: unknown, signal?: AbortSignal): AppError {
  if (e instanceof AppError) return e;
  if (signal?.aborted || isAbortError(e)) return new AppError('aborted');
  return new AppError('network');
}

function startsWithPdfMagic(bytes: Uint8Array): boolean {
  if (bytes.byteLength < PDF_MAGIC.length) return false;
  for (let i = 0; i < PDF_MAGIC.length; i++) {
    if (bytes[i] !== PDF_MAGIC.charCodeAt(i)) return false;
  }
  return true;
}

/** Joins streamed chunks into one exact-size buffer. */
function joinChunks(chunks: Uint8Array[], total: number): ArrayBuffer {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out.buffer as ArrayBuffer;
}

/** Reads the body with progress. Stops above MAX_DOWNLOAD_BYTES. */
async function readStream(
  body: ReadableStream<Uint8Array>,
  total: number | null,
  onProgress: DownloadProgress | undefined,
): Promise<ArrayBuffer> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_DOWNLOAD_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new AppError('too-large');
    }
    chunks.push(value);
    onProgress?.(received, total);
  }
  return joinChunks(chunks, received);
}

/**
 * Downloads one score PDF from upload.wikimedia.org (SPEC 1.7 item 4, 1.9 item 5).
 * Resolves with the bytes. Never returns more than MAX_DOWNLOAD_BYTES.
 */
export async function downloadScore(
  hit: ScoreHit,
  onProgress?: DownloadProgress,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const fileUrl = hit.fileUrl;
  if (fileUrl === null || !fileUrl.startsWith(UPLOAD_PREFIX)) throw new AppError('bad-response');
  if (!navigator.onLine) throw new AppError('offline');

  try {
    const response = await fetch(fileUrl, { signal });
    // 429 has its own message. Other failed statuses (404, 5xx) mean the source is not reachable.
    // Only a 200 response whose body is not a PDF is 'bad-response' (checked below).
    if (response.status === 429) {
      await response.body?.cancel().catch(() => undefined);
      throw new AppError('rate-limited');
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new AppError('network');
    }

    const header = response.headers.get('Content-Length');
    const declared = header === null ? NaN : Number(header);
    if (Number.isFinite(declared) && declared > MAX_DOWNLOAD_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      throw new AppError('too-large');
    }
    const total = Number.isFinite(declared) ? declared : null;

    let buffer: ArrayBuffer;
    if (response.body) {
      buffer = await readStream(response.body, total, onProgress);
    } else {
      buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_DOWNLOAD_BYTES) throw new AppError('too-large');
      onProgress?.(buffer.byteLength, total);
    }

    if (!startsWithPdfMagic(new Uint8Array(buffer))) throw new AppError('bad-response');
    return buffer;
  } catch (e) {
    throw toAppError(e, signal);
  }
}
