import type { GestureController, GestureControllerDeps, GestureSnapshot, PoseSample, PoseStatus } from '../contracts';
import { setProbe } from '../app/testHook';
import { createGestureEngine, configFromSettings } from './engine';

/**
 * Feeds pose samples to the gesture engine and reports turns (SPEC 1.6, Controller).
 * Calibration starts when the pose status becomes 'running' while the engine is idle.
 */
export function createGestureController(deps: GestureControllerDeps): GestureController {
  const engine = createGestureEngine(configFromSettings(deps.getSettings()));
  const subs = new Set<() => void>();
  let started = false;
  /** Increased by every stop(). A pending start() that sees a change does nothing. */
  let runCounter = 0;
  let unsubSample: (() => void) | null = null;
  let unsubStatus: (() => void) | null = null;

  const notify = (): void => {
    for (const cb of [...subs]) cb();
  };

  const snapshot = (): GestureSnapshot => ({ status: deps.pose.getStatus(), state: engine.getState() });

  const calibrateIfIdle = (): void => {
    if (engine.getState().phase === 'idle') engine.calibrate();
  };

  const onSample = (s: PoseSample): void => {
    engine.setConfig(configFromSettings(deps.getSettings()));
    const events = engine.push(s);
    for (const e of events) {
      if (e.type === 'turn') deps.onTurn(e.dir);
    }
    notify();
  };

  const onStatus = (status: PoseStatus): void => {
    if (status === 'running') calibrateIfIdle();
    notify();
  };

  const detach = (): void => {
    unsubSample?.();
    unsubStatus?.();
    unsubSample = null;
    unsubStatus = null;
  };

  return {
    async start() {
      if (deps.getSettings().gesture === 'off') return;
      if (started) return;
      started = true;
      const run = runCounter;
      setProbe('gesture', () => snapshot());
      unsubSample = deps.pose.subscribe(onSample);
      unsubStatus = deps.pose.onStatus(onStatus);
      await deps.pose.start();
      if (run !== runCounter) return;
      // The status may already be 'running' when start() resolves (the test source).
      if (deps.pose.getStatus() === 'running') calibrateIfIdle();
      notify();
    },

    stop() {
      runCounter += 1;
      started = false;
      detach();
      deps.pose.stop();
      engine.reset();
      setProbe('gesture', null);
      notify();
    },

    recalibrate() {
      engine.calibrate();
      notify();
    },

    setPaused(paused) {
      engine.setPaused(paused);
      notify();
    },

    getSnapshot: snapshot,

    subscribe(cb) {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },

    getVideoStream: () => deps.pose.getVideoStream(),
  };
}
