import type { GestureConfig, GestureEngine, GestureEvent, GestureState, PoseSample, Settings } from '../contracts';

export function configFromSettings(s: Settings): GestureConfig {
  return {
    kind: s.gesture === 'mouth' ? 'mouth' : 'head',
    yawThresholdDeg: s.yawThresholdDeg,
    holdMs: s.holdMs,
    cooldownMs: s.cooldownMs,
    mouthThreshold: s.mouthThreshold,
    flip: s.flipDirection,
  };
}

/** STUB: replaced by package gesture-engine. Never emits; the state stays idle. */
export function createGestureEngine(_config: GestureConfig): GestureEngine {
  const state: GestureState = {
    phase: 'idle', dir: null, armProgress: 0, cooldownProgress: 0, calibrationProgress: 0,
    facePresent: false, relYawDeg: 0, neutralYawDeg: null, paused: false,
  };
  return {
    push(_sample: PoseSample): GestureEvent[] {
      return [];
    },
    calibrate() {},
    setConfig() {},
    setPaused(paused) {
      state.paused = paused;
    },
    getState: () => ({ ...state }),
    reset() {},
  };
}
