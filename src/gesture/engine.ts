import {
  GESTURE_CONSTANTS as C,
  type GestureConfig,
  type GestureEngine,
  type GestureEvent,
  type GestureState,
  type GesturePhase,
  type PoseSample,
  type Settings,
  type TurnDir,
} from '../contracts';

/** Local constants (SPEC 1.6). Not in contracts.ts. */
const CALIBRATION_MAX_SPREAD_DEG = 10;
const PITCH_GATE_DEG = 15;

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

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const mid = v.length >> 1;
  return v.length % 2 === 1 ? (v[mid] as number) : ((v[mid - 1] as number) + (v[mid] as number)) / 2;
}

/**
 * Pure gesture state machine (SPEC 1.6). It reads time only from sample.t.
 * No timers, no DOM, no Date.now.
 */
export function createGestureEngine(config: GestureConfig): GestureEngine {
  let cfg: GestureConfig = config;
  let phase: GesturePhase = 'idle';
  let paused = false;
  let lastT: number | null = null;
  let facePresent = false;
  let absentSince: number | null = null;

  let neutralYaw: number | null = null;
  let neutralPitch: number | null = null;

  // Filter state. filterEmpty means the next sample starts the filter.
  let rel = 0;
  let filterEmpty = true;

  let armDir: TurnDir | null = null;
  let armStart: number | null = null;
  let cooldownStart: number | null = null;
  let neutralSince: number | null = null;

  // Calibration counters.
  let calStart: number | null = null;
  let calCount = 0;
  let calYaw: number[] = [];
  let calPitch: number[] = [];
  let calibrationProgress = 0;

  const resetFilter = (): void => {
    rel = 0;
    filterEmpty = true;
  };

  const clearArming = (): void => {
    armDir = null;
    armStart = null;
  };

  const clearCalibrationCounters = (): void => {
    calStart = null;
    calCount = 0;
    calYaw = [];
    calPitch = [];
    calibrationProgress = 0;
  };

  /** Steps 3 (calibrating). Returns the events of this sample. */
  function stepCalibrating(s: PoseSample): GestureEvent[] {
    const t = s.t;
    if (calStart === null) calStart = t;
    calCount += 1;
    if (s.facePresent) {
      calYaw.push(s.yawDeg);
      if (typeof s.pitchDeg === 'number') calPitch.push(s.pitchDeg);
    }
    const elapsed = t - calStart;
    calibrationProgress = clamp01(elapsed / C.CALIBRATION_MS);
    if (elapsed < C.CALIBRATION_MS) return [];

    const spread = calYaw.length > 0 ? Math.max(...calYaw) - Math.min(...calYaw) : Infinity;
    const steady =
      calYaw.length >= C.CALIBRATION_MIN_SAMPLES &&
      calYaw.length / calCount >= C.CALIBRATION_MIN_FACE_RATIO &&
      spread <= CALIBRATION_MAX_SPREAD_DEG;
    if (steady) {
      neutralYaw = median(calYaw);
      neutralPitch = calPitch.length > 0 ? median(calPitch) : null;
      phase = 'neutral';
      resetFilter();
      clearCalibrationCounters();
      return [{ type: 'calibrated', neutralYawDeg: neutralYaw, t }];
    }
    clearCalibrationCounters();
    return [{ type: 'calibration-failed', t }];
  }

  function push(s: PoseSample): GestureEvent[] {
    const t = s.t;
    const prevT = lastT;
    lastT = t;

    // Step 1: paused.
    if (paused) {
      facePresent = s.facePresent;
      absentSince = s.facePresent ? null : (absentSince ?? t);
      return [];
    }

    // Step 2: gap.
    if (prevT !== null && t - prevT > C.GAP_RESET_MS &&
        (phase === 'neutral' || phase === 'arming' || phase === 'wait-neutral')) {
      phase = 'wait-neutral';
      clearArming();
      neutralSince = null;
      resetFilter();
    }

    facePresent = s.facePresent;

    // Step 3: calibrating.
    if (phase === 'calibrating') return stepCalibrating(s);

    // Step 4: idle (never calibrated).
    if (phase === 'idle') return [];

    // Step 5: face absent.
    if (!s.facePresent) {
      if (absentSince === null) absentSince = t;
      if (t - absentSince >= C.FACE_LOST_MS && phase !== 'no-face') {
        phase = 'no-face';
        clearArming();
        return [{ type: 'face', present: false, t }];
      }
      return [];
    }

    // Step 6: face present.
    const events: GestureEvent[] = [];
    if (phase === 'no-face') {
      events.push({ type: 'face', present: true, t });
      phase = 'wait-neutral';
      neutralSince = null;
      resetFilter();
    }
    absentSince = null;

    // Step 7: signal.
    const pitchOff =
      neutralPitch !== null && typeof s.pitchDeg === 'number' &&
      Math.abs(s.pitchDeg - neutralPitch) > PITCH_GATE_DEG;

    const base = neutralYaw ?? s.yawDeg;
    const raw = (s.yawDeg - base) * (cfg.flip ? -1 : 1);
    rel = filterEmpty ? raw : C.EMA_ALPHA * raw + (1 - C.EMA_ALPHA) * rel;
    filterEmpty = false;

    const T = cfg.yawThresholdDeg;
    let active: TurnDir | null;
    let heldNext: boolean;
    let heldPrev: boolean;
    let isNeutral: boolean;

    if (cfg.kind === 'head') {
      active = rel >= T ? 'next' : rel <= -T ? 'prev' : null;
      heldNext = rel >= T - C.ARM_HYSTERESIS_DEG;
      heldPrev = rel <= -(T - C.ARM_HYSTERESIS_DEG);
      isNeutral = Math.abs(rel) < C.NEUTRAL_DEG;
    } else {
      const M = cfg.mouthThreshold;
      const r = cfg.flip ? s.mouthLeft : s.mouthRight;
      const l = cfg.flip ? s.mouthRight : s.mouthLeft;
      active = r >= M && l < C.MOUTH_OTHER_MAX ? 'next' : l >= M && r < C.MOUTH_OTHER_MAX ? 'prev' : null;
      heldNext = r >= M - C.MOUTH_HYSTERESIS && l < C.MOUTH_OTHER_MAX;
      heldPrev = l >= M - C.MOUTH_HYSTERESIS && r < C.MOUTH_OTHER_MAX;
      isNeutral = r < M / 2 && l < M / 2;
    }

    if (pitchOff) {
      active = null;
      heldNext = false;
      heldPrev = false;
    }

    // Step 8: phase step.
    const held = (dir: TurnDir): boolean => (dir === 'next' ? heldNext : heldPrev);

    if (phase === 'neutral') {
      if (active) {
        phase = 'arming';
        armDir = active;
        armStart = t;
      } else if (cfg.kind === 'head' && Math.abs(rel) < C.DRIFT_MAX_DEG && neutralYaw !== null) {
        neutralYaw += C.DRIFT_ALPHA * (s.yawDeg - neutralYaw);
      }
    } else if (phase === 'arming') {
      if (armDir === null || armStart === null || !held(armDir)) {
        phase = 'neutral';
        clearArming();
      } else if (t - armStart >= cfg.holdMs) {
        events.push({ type: 'turn', dir: armDir, t });
        phase = 'cooldown';
        cooldownStart = t;
        clearArming();
      }
    } else if (phase === 'cooldown') {
      if (cooldownStart !== null && t - cooldownStart >= cfg.cooldownMs) {
        phase = 'wait-neutral';
        neutralSince = null;
      }
    } else if (phase === 'wait-neutral') {
      if (isNeutral) {
        if (neutralSince === null) neutralSince = t;
        const cooldownDone = cooldownStart === null || t - cooldownStart >= cfg.cooldownMs;
        if (t - neutralSince >= C.REARM_MS && cooldownDone) {
          phase = 'neutral';
        }
      } else {
        neutralSince = null;
      }
    }

    return events;
  }

  return {
    push,

    calibrate() {
      phase = 'calibrating';
      clearCalibrationCounters();
      clearArming();
      neutralSince = null;
      resetFilter();
    },

    setConfig(config: GestureConfig) {
      cfg = config;
    },

    setPaused(next: boolean) {
      paused = next;
      if (!next && (phase === 'arming' || phase === 'neutral' || phase === 'cooldown' || phase === 'wait-neutral')) {
        phase = 'wait-neutral';
        clearArming();
        neutralSince = null;
        resetFilter();
      }
    },

    getState(): GestureState {
      const now = lastT ?? 0;
      return {
        phase,
        dir: phase === 'arming' ? armDir : null,
        armProgress:
          phase === 'arming' && armStart !== null ? clamp01((now - armStart) / cfg.holdMs) : 0,
        cooldownProgress:
          phase === 'cooldown' && cooldownStart !== null
            ? clamp01((now - cooldownStart) / cfg.cooldownMs)
            : 0,
        calibrationProgress,
        facePresent,
        relYawDeg: rel,
        neutralYawDeg: neutralYaw,
        paused,
      };
    },

    reset() {
      phase = 'idle';
      lastT = null;
      facePresent = false;
      absentSince = null;
      neutralYaw = null;
      neutralPitch = null;
      resetFilter();
      clearArming();
      cooldownStart = null;
      neutralSince = null;
      clearCalibrationCounters();
    },
  };
}
