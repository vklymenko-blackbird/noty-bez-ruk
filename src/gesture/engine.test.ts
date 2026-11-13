import { describe, expect, it } from 'vitest';
import type { GestureConfig, GestureEvent, PoseSample } from '../contracts';
import { DEFAULT_SETTINGS } from '../contracts';
import { configFromSettings, createGestureEngine } from './engine';

const HEAD: GestureConfig = {
  kind: 'head',
  yawThresholdDeg: 20,
  holdMs: 500,
  cooldownMs: 1500,
  mouthThreshold: 0.5,
  flip: false,
};

type Opts = { face?: boolean; pitch?: number; mouthL?: number; mouthR?: number };

/** Builds samples at 10 per second, from t0 for n samples (inclusive of t0). */
function series(t0: number, n: number, yaw: number, o: Opts = {}): PoseSample[] {
  const out: PoseSample[] = [];
  for (let i = 0; i < n; i++) {
    const s: PoseSample = {
      t: t0 + i * 100,
      facePresent: o.face ?? true,
      yawDeg: yaw,
      mouthLeft: o.mouthL ?? 0,
      mouthRight: o.mouthR ?? 0,
    };
    if (o.pitch !== undefined) s.pitchDeg = o.pitch;
    out.push(s);
  }
  return out;
}

/** Runs samples and collects every event. */
function run(engine: ReturnType<typeof createGestureEngine>, samples: PoseSample[]): GestureEvent[] {
  const events: GestureEvent[] = [];
  for (const s of samples) events.push(...engine.push(s));
  return events;
}

const turns = (events: GestureEvent[]): string[] =>
  events.flatMap((e) => (e.type === 'turn' ? [e.dir] : []));

/** Engine calibrated at yaw 0 (and pitch 0 when given). Calibration ends at t = 2000. */
function calibrated(cfg: GestureConfig = HEAD, pitch?: number) {
  const engine = createGestureEngine(cfg);
  engine.calibrate();
  run(engine, series(0, 21, 0, pitch === undefined ? {} : { pitch }));
  expect(engine.getState().phase).toBe('neutral');
  return engine;
}

describe('gesture engine: head', () => {
  it('calibrates after 2 s of a still head', () => {
    const engine = createGestureEngine(HEAD);
    engine.calibrate();
    const events = run(engine, series(0, 21, 3));
    expect(events).toEqual([{ type: 'calibrated', neutralYawDeg: 3, t: 2000 }]);
    expect(engine.getState().phase).toBe('neutral');
  });

  it('no turn in idle (before calibrate)', () => {
    const engine = createGestureEngine(HEAD);
    expect(run(engine, series(0, 30, 30))).toEqual([]);
    expect(engine.getState().phase).toBe('idle');
  });

  it('a right turn in flip mode gives prev', () => {
    const engine = createGestureEngine({ ...HEAD, flip: true });
    engine.calibrate();
    run(engine, series(0, 21, 0));
    expect(turns(run(engine, series(2100, 15, 30)))).toEqual(['prev']);
  });

  it('a higher threshold (35) ignores a 30 degree turn', () => {
    const high = calibrated({ ...HEAD, yawThresholdDeg: 35 });
    expect(turns(run(high, series(2100, 15, 30)))).toEqual([]);
    const normal = calibrated(HEAD);
    expect(turns(run(normal, series(2100, 15, 30)))).toEqual(['next']);
  });

  it('holdMs 1000 needs a longer hold than 600 ms', () => {
    const long = calibrated({ ...HEAD, holdMs: 1000 });
    expect(turns(run(long, series(2100, 7, 30)))).toEqual([]);
    const longer = calibrated({ ...HEAD, holdMs: 1000 });
    expect(turns(run(longer, series(2100, 15, 30)))).toEqual(['next']);
  });

  it('a hold that drops below threshold minus 3 is cancelled', () => {
    // The filter starts empty after calibration, so arming starts at 2100.
    // Steady 15 from 2300 is below 17: the hold is cancelled at 2500 (before 500 ms).
    const engine = calibrated();
    const samples = [...series(2100, 2, 30), ...series(2300, 20, 15)];
    expect(turns(run(engine, samples))).toEqual([]);
    // Steady 18 stays above 17, so the hold completes at 2600 (500 ms after 2100).
    const kept = calibrated();
    const kept2 = [...series(2100, 2, 30), ...series(2300, 20, 18)];
    expect(turns(run(kept, kept2))).toEqual(['next']);
  });

  it('exactly one turn while the head stays turned for 6 s', () => {
    const engine = calibrated();
    expect(turns(run(engine, series(2100, 60, 30)))).toEqual(['next']);
  });

  it('a glance shorter than holdMs gives none', () => {
    const engine = calibrated();
    expect(turns(run(engine, [...series(2100, 4, 30), ...series(2500, 10, 0)]))).toEqual([]);
  });

  it('setPaused(true) blocks turns and unpausing needs neutral first', () => {
    const engine = calibrated();
    engine.setPaused(true);
    expect(turns(run(engine, series(2100, 10, 30)))).toEqual([]);
    expect(engine.getState().paused).toBe(true);
    engine.setPaused(false);
    expect(engine.getState().phase).toBe('wait-neutral');
    // Still turned: no turn until the head is neutral for 200 ms.
    expect(turns(run(engine, series(3100, 10, 30)))).toEqual([]);
    // Neutral for 1 s, then turned again: one turn.
    run(engine, series(4100, 10, 0));
    expect(turns(run(engine, series(5100, 15, 30)))).toEqual(['next']);
  });

  it('a gap of 2 s between samples cancels arming', () => {
    const engine = calibrated();
    run(engine, series(2100, 3, 30));
    expect(engine.getState().phase).toBe('arming');
    // Next sample comes 2 s later: arming is cancelled, the hold does not count.
    const events = run(engine, series(4400, 1, 30));
    expect(events).toEqual([]);
    expect(engine.getState().phase).toBe('wait-neutral');
    expect(turns(run(engine, series(4500, 10, 30)))).toEqual([]);
  });

  it('armProgress and cooldownProgress follow the timers', () => {
    const engine = calibrated();
    run(engine, series(2100, 1, 30)); // arming starts at 2100 (filter empty)
    expect(engine.getState().armProgress).toBe(0);
    run(engine, series(2200, 2, 30)); // 2200 and 2300
    expect(engine.getState().armProgress).toBeCloseTo(0.4, 5);
    expect(engine.getState().dir).toBe('next');
    // Turn fires at 2600 (armStart 2100 + 500). Cooldown is 1500 ms.
    const events = run(engine, series(2400, 3, 30)); // 2400, 2500, 2600
    expect(events).toEqual([{ type: 'turn', dir: 'next', t: 2600 }]);
    expect(engine.getState().phase).toBe('cooldown');
    run(engine, series(2700, 3, 30)); // 2700, 2800, 2900
    expect(engine.getState().cooldownProgress).toBeCloseTo(0.2, 5);
    expect(engine.getState().armProgress).toBe(0);
  });

  it('drift moves neutralYawDeg slowly', () => {
    const engine = calibrated();
    run(engine, series(2100, 100, 4));
    const neutral = engine.getState().neutralYawDeg ?? NaN;
    expect(neutral).toBeGreaterThan(2);
    expect(neutral).toBeLessThan(4);
    expect(engine.getState().phase).toBe('neutral');
  });

  it('reset returns to idle', () => {
    const engine = calibrated();
    engine.reset();
    const state = engine.getState();
    expect(state.phase).toBe('idle');
    expect(state.neutralYawDeg).toBeNull();
    expect(run(engine, series(5000, 30, 30))).toEqual([]);
  });

  it('a face absent for 400 ms emits face:false and the face back emits face:true', () => {
    const engine = calibrated();
    const events = run(engine, [...series(2100, 5, 0, { face: false }), ...series(2600, 2, 0)]);
    expect(events).toEqual([
      { type: 'face', present: false, t: 2500 },
      { type: 'face', present: true, t: 2600 },
    ]);
    expect(engine.getState().phase).toBe('wait-neutral');
  });

  it('a 34 degree hold of 1 s with ONE missing-face sample gives exactly one turn', () => {
    const engine = calibrated();
    const samples = series(2100, 11, 34);
    samples[5] = { ...(samples[5] as PoseSample), facePresent: false };
    expect(turns(run(engine, samples))).toEqual(['next']);
  });

  it('a face absent 100 ms, present 300 ms, absent 100 ms never reaches no-face', () => {
    const engine = calibrated();
    const samples = [
      ...series(2100, 2, 0, { face: false }),
      ...series(2300, 3, 0),
      ...series(2600, 2, 0, { face: false }),
      ...series(2800, 2, 0),
    ];
    const phases: string[] = [];
    let events: GestureEvent[] = [];
    for (const s of samples) {
      events = events.concat(engine.push(s));
      phases.push(engine.getState().phase);
    }
    expect(events).toEqual([]);
    expect(phases).not.toContain('no-face');
  });

  it('a calibration window with a 25 degree sweep fails, the next steady window passes', () => {
    const engine = createGestureEngine(HEAD);
    engine.calibrate();
    const sweep: PoseSample[] = [];
    for (let i = 0; i <= 20; i++) {
      sweep.push({ t: i * 100, facePresent: true, yawDeg: i * 1.25, mouthLeft: 0, mouthRight: 0 });
    }
    expect(run(engine, sweep)).toEqual([{ type: 'calibration-failed', t: 2000 }]);
    expect(engine.getState().phase).toBe('calibrating');
    const events = run(engine, series(2100, 21, 0));
    expect(events).toEqual([{ type: 'calibrated', neutralYawDeg: 0, t: 4100 }]);
  });

  it('yaw 30 with pitch 25 (calibrated pitch 0) gives no turn; with pitch 0 it gives one', () => {
    const tilted = calibrated(HEAD, 0);
    expect(turns(run(tilted, series(2100, 20, 30, { pitch: 25 })))).toEqual([]);
    const level = calibrated(HEAD, 0);
    expect(turns(run(level, series(2100, 15, 30, { pitch: 0 })))).toEqual(['next']);
  });

  it('samples without pitchDeg work as before', () => {
    const engine = calibrated();
    expect(turns(run(engine, series(2100, 15, 30)))).toEqual(['next']);
  });
});

describe('gesture engine: mouth', () => {
  const MOUTH: GestureConfig = { ...HEAD, kind: 'mouth' };

  it('mouthRight fires next', () => {
    const engine = calibrated(MOUTH);
    expect(turns(run(engine, series(2100, 15, 0, { mouthR: 0.8, mouthL: 0.1 })))).toEqual(['next']);
  });

  it('mouthLeft fires prev, and mouthLeft with flip fires next', () => {
    const engine = calibrated(MOUTH);
    expect(turns(run(engine, series(2100, 15, 0, { mouthL: 0.8, mouthR: 0.1 })))).toEqual(['prev']);
    const flipped = calibrated({ ...MOUTH, flip: true });
    expect(turns(run(flipped, series(2100, 15, 0, { mouthL: 0.8, mouthR: 0.1 })))).toEqual(['next']);
  });

  it('does not fire when both sides are high', () => {
    const engine = calibrated(MOUTH);
    expect(turns(run(engine, series(2100, 20, 0, { mouthR: 0.8, mouthL: 0.6 })))).toEqual([]);
  });
});

describe('gesture engine: configFromSettings', () => {
  it('maps kind and flip from the settings', () => {
    expect(configFromSettings({ ...DEFAULT_SETTINGS, gesture: 'mouth', flipDirection: true })).toEqual({
      kind: 'mouth',
      yawThresholdDeg: 20,
      holdMs: 500,
      cooldownMs: 1500,
      mouthThreshold: 0.5,
      flip: true,
    });
    expect(configFromSettings({ ...DEFAULT_SETTINGS, gesture: 'head' }).kind).toBe('head');
  });
});
