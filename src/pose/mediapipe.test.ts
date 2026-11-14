import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PoseStatus } from '../contracts';

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: async () => ({}) },
  FaceLandmarker: {
    createFromOptions: async () => ({
      detectForVideo: () => ({ faceLandmarks: [] }),
      close: () => undefined,
    }),
  },
}));

import { createMediaPipePoseSource } from './mediapipe';

class FakeTrack extends EventTarget {
  stopped = false;
  stop(): void {
    this.stopped = true;
  }
}

function installCamera(track: FakeTrack): void {
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: async () => stream },
  });
}

async function startSource() {
  const track = new FakeTrack();
  installCamera(track);
  const src = createMediaPipePoseSource({ useGpu: false });
  const seen: PoseStatus[] = [];
  src.onStatus((s) => seen.push(s));
  await src.start();
  return { src, track, seen };
}

describe('mediapipe camera loss', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLVideoElement.prototype, 'play').mockResolvedValue(undefined);
    Object.defineProperty(HTMLVideoElement.prototype, 'srcObject', { configurable: true, get: () => null, set: () => undefined });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sets unavailable when the video track ends', async () => {
    const { src, track, seen } = await startSource();
    expect(seen).toContain('loading');
    track.dispatchEvent(new Event('ended'));
    expect(src.getStatus()).toBe('unavailable');
    expect(track.stopped).toBe(true);
    expect(src.getVideoStream()).toBeNull();
  });

  it('sets unavailable after a long mute', async () => {
    const { src, track } = await startSource();
    track.dispatchEvent(new Event('mute'));
    vi.advanceTimersByTime(1000);
    expect(src.getStatus()).not.toBe('unavailable');
    vi.advanceTimersByTime(3000);
    expect(src.getStatus()).toBe('unavailable');
  });

  it('ignores a short mute', async () => {
    const { src, track } = await startSource();
    track.dispatchEvent(new Event('mute'));
    vi.advanceTimersByTime(1000);
    track.dispatchEvent(new Event('unmute'));
    vi.advanceTimersByTime(10000);
    expect(src.getStatus()).not.toBe('unavailable');
    src.stop();
  });
});
