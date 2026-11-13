import type { PoseSample, PoseSource, PoseStatus } from '../contracts';

/** STUB: replaced by package pose-mediapipe. start() sets the status 'unavailable'. */
export function createMediaPipePoseSource(_opts: { useGpu: boolean }): PoseSource {
  let status: PoseStatus = 'idle';
  const statusSubs = new Set<(s: PoseStatus) => void>();
  const subs = new Set<(s: PoseSample) => void>();
  return {
    async start() {
      status = 'unavailable';
      statusSubs.forEach((cb) => cb(status));
    },
    stop() {
      status = 'idle';
      statusSubs.forEach((cb) => cb(status));
    },
    getStatus: () => status,
    subscribe(cb) {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    onStatus(cb) {
      statusSubs.add(cb);
      return () => {
        statusSubs.delete(cb);
      };
    },
    getVideoStream: () => null,
  };
}
