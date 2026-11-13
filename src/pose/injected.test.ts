import { describe, expect, it } from 'vitest';
import type { PoseSample } from '../contracts';
import { createInjectedPoseSource } from './injected';

const s = (t: number): PoseSample => ({ t, facePresent: true, yawDeg: 0, mouthLeft: 0, mouthRight: 0 });

describe('injected pose source', () => {
  it('starts running and pushes samples', async () => {
    const src = createInjectedPoseSource();
    const got: number[] = [];
    src.subscribe((x) => got.push(x.t));
    await src.start();
    expect(src.getStatus()).toBe('running');
    src.push(s(5));
    expect(got).toEqual([5]);
    src.stop();
    expect(src.getStatus()).toBe('idle');
  });
  it('replay keeps timestamps monotonic', () => {
    const src = createInjectedPoseSource();
    const got: number[] = [];
    src.subscribe((x) => got.push(x.t));
    src.replay([s(0), s(100)]);
    src.replay([s(0), s(100)]);
    expect(got).toEqual([0, 100, 200, 300]);
  });
});
