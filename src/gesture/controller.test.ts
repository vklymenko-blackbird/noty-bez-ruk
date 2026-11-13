import { describe, expect, it } from 'vitest';
import type { GestureControllerDeps, PoseSample, PoseSource, PoseStatus, Settings, TurnDir } from '../contracts';
import { DEFAULT_SETTINGS } from '../contracts';
import { createGestureController } from './controller';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface FakeOpts {
  /** start() sets 'loading' and turns 'running' this many ms later. */
  lateRunningMs?: number;
  /** start() resolves only after this many ms. */
  startDelayMs?: number;
}

/** A pose source written for the tests. Samples are pushed by the test. */
class FakePose implements PoseSource {
  status: PoseStatus = 'idle';
  startCalls = 0;
  stopCalls = 0;
  private stopped = false;
  private sampleCbs = new Set<(s: PoseSample) => void>();
  private statusCbs = new Set<(s: PoseStatus) => void>();

  constructor(private opts: FakeOpts = {}) {}

  async start(): Promise<void> {
    this.startCalls += 1;
    this.stopped = false;
    if (this.opts.lateRunningMs !== undefined) {
      this.setStatus('loading');
      setTimeout(() => {
        if (!this.stopped) this.setStatus('running');
      }, this.opts.lateRunningMs);
      return;
    }
    if (this.opts.startDelayMs !== undefined) await sleep(this.opts.startDelayMs);
    if (!this.stopped) this.setStatus('running');
  }

  stop(): void {
    this.stopCalls += 1;
    this.stopped = true;
    this.setStatus('idle');
  }

  getStatus(): PoseStatus {
    return this.status;
  }

  subscribe(cb: (s: PoseSample) => void): () => void {
    this.sampleCbs.add(cb);
    return () => {
      this.sampleCbs.delete(cb);
    };
  }

  onStatus(cb: (s: PoseStatus) => void): () => void {
    this.statusCbs.add(cb);
    return () => {
      this.statusCbs.delete(cb);
    };
  }

  getVideoStream(): MediaStream | null {
    return null;
  }

  push(s: PoseSample): void {
    for (const cb of [...this.sampleCbs]) cb(s);
  }

  private setStatus(status: PoseStatus): void {
    this.status = status;
    for (const cb of [...this.statusCbs]) cb(status);
  }
}

function setup(opts: FakeOpts = {}, settings: Partial<Settings> = {}) {
  const pose = new FakePose(opts);
  const turns: TurnDir[] = [];
  const deps: GestureControllerDeps = {
    pose,
    getSettings: () => ({ ...DEFAULT_SETTINGS, gesture: 'head', ...settings }),
    onTurn: (dir) => turns.push(dir),
  };
  return { pose, turns, ctrl: createGestureController(deps) };
}

const sample = (t: number, yawDeg: number): PoseSample => ({
  t,
  facePresent: true,
  yawDeg,
  mouthLeft: 0,
  mouthRight: 0,
});

/** Calibration (0..2000 ms at yaw 0) followed by a right turn held for 1 s. */
function rightTurn(t0 = 0): PoseSample[] {
  const out: PoseSample[] = [];
  for (let t = t0; t <= t0 + 2000; t += 100) out.push(sample(t, 0));
  for (let t = t0 + 2100; t <= t0 + 3100; t += 100) out.push(sample(t, 30));
  return out;
}

describe('gesture controller', () => {
  it('start calibrates when the pose source is already running', async () => {
    const { ctrl } = setup();
    await ctrl.start();
    expect(ctrl.getSnapshot().status).toBe('running');
    expect(ctrl.getSnapshot().state.phase).toBe('calibrating');
    ctrl.stop();
  });

  it('a replayed right turn calls onTurn("next") once', async () => {
    const { pose, turns, ctrl } = setup();
    await ctrl.start();
    for (const s of rightTurn()) pose.push(s);
    expect(turns).toEqual(['next']);
    ctrl.stop();
  });

  it('gesture off never starts the pose source', async () => {
    const { pose, ctrl } = setup({}, { gesture: 'off' });
    await ctrl.start();
    expect(pose.startCalls).toBe(0);
    expect(ctrl.getSnapshot().status).toBe('idle');
    ctrl.stop();
  });

  it('stop stops the pose source and resets the engine', async () => {
    const { pose, ctrl } = setup();
    await ctrl.start();
    ctrl.stop();
    expect(pose.stopCalls).toBe(1);
    expect(ctrl.getSnapshot().state.phase).toBe('idle');
  });

  it('subscribers are notified on samples and on status changes', async () => {
    const { pose, ctrl } = setup();
    let count = 0;
    const unsub = ctrl.subscribe(() => {
      count += 1;
    });
    await ctrl.start();
    const afterStart = count;
    expect(afterStart).toBeGreaterThan(0);
    pose.push(sample(0, 0));
    expect(count).toBe(afterStart + 1);
    unsub();
    pose.push(sample(100, 0));
    expect(count).toBe(afterStart + 1);
    ctrl.stop();
  });

  it('a second start() while one is active does nothing', async () => {
    const { pose, ctrl } = setup();
    await ctrl.start();
    await ctrl.start();
    expect(pose.startCalls).toBe(1);
    ctrl.stop();
  });

  it('start() after stop() works again', async () => {
    const { pose, ctrl } = setup();
    await ctrl.start();
    ctrl.stop();
    await ctrl.start();
    expect(pose.startCalls).toBe(2);
    expect(ctrl.getSnapshot().state.phase).toBe('calibrating');
    ctrl.stop();
  });

  it('LATE RUNNING: calibration starts when the status becomes running later', async () => {
    const { ctrl } = setup({ lateRunningMs: 50 });
    await ctrl.start();
    expect(ctrl.getSnapshot().status).toBe('loading');
    expect(ctrl.getSnapshot().state.phase).toBe('idle');
    await sleep(100);
    expect(ctrl.getSnapshot().status).toBe('running');
    expect(ctrl.getSnapshot().state.phase).toBe('calibrating');
    ctrl.stop();
  });

  it('STOP DURING START: stop() before a slow start() resolves leaves the controller stopped', async () => {
    const { pose, ctrl } = setup({ startDelayMs: 50 });
    void ctrl.start();
    ctrl.stop();
    await sleep(100);
    expect(ctrl.getSnapshot().state.phase).toBe('idle');
    expect(pose.stopCalls).toBeGreaterThan(0);
  });

  it('recalibrate and setPaused pass through to the engine', async () => {
    const { ctrl } = setup();
    await ctrl.start();
    ctrl.recalibrate();
    expect(ctrl.getSnapshot().state.phase).toBe('calibrating');
    ctrl.setPaused(true);
    expect(ctrl.getSnapshot().state.paused).toBe(true);
    ctrl.stop();
  });
});
