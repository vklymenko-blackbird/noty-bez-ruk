import { AppError, type DownloadProgress, type ScoreHit } from '../contracts';

/** STUB: replaced by package sources-commons. */
export async function downloadScore(_hit: ScoreHit, _onProgress?: DownloadProgress, _signal?: AbortSignal): Promise<ArrayBuffer> {
  throw new AppError('network');
}
