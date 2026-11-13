import type { InjectedPoseSource, PoseSample, PoseStatus } from '../contracts';

/** A pose source driven by tests. push() and replay() deliver samples synchronously. */
export function createInjectedPoseSource(): InjectedPoseSource {
  let status: PoseStatus = 'idle';
  let lastT = 0;
  let hasSample = false;
  const subs = new Set<(s: PoseSample) => void>();
  const statusSubs = new Set<(s: PoseStatus) => void>();
  const setStatus = (s: PoseStatus) => {
    status = s;
    statusSubs.forEach((cb) => cb(s));
  };
  const deliver = (s: PoseSample) => {
    lastT = s.t;
    hasSample = true;
    subs.forEach((cb) => cb(s));
  };
  return {
    async start() {
      setStatus('running');
    },
    stop() {
      setStatus('idle');
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
    push(sample) {
      deliver(sample);
    },
    replay(samples) {
      if (samples.length === 0) return;
      const shift = (hasSample ? lastT + 100 : 0) - samples[0].t;
      for (const s of samples) deliver({ ...s, t: s.t + shift });
    },
  };
}

let shared: InjectedPoseSource | null = null;

export function getInjectedPoseSource(): InjectedPoseSource {
  if (!shared) shared = createInjectedPoseSource();
  return shared;
}
