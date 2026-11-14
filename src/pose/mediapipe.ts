import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { GESTURE_CONSTANTS } from '../contracts';
import type { PoseSample, PoseSource, PoseStatus } from '../contracts';
import { mouthFromBlendshapes, pitchFromMatrix, yawFromLandmarks, yawFromMatrix } from './yaw';

/** One camera session. stop() releases it; every await in start() checks that it is still current. */
interface Session {
  gen: number;
  released: boolean;
  stream?: MediaStream;
  video?: HTMLVideoElement;
  landmarker?: FaceLandmarker;
  timer?: ReturnType<typeof setTimeout>;
  errors: number;
  faceSeen: boolean;
}

type Vision = typeof import('@mediapipe/tasks-vision');
type Fileset = Awaited<ReturnType<Vision['FilesetResolver']['forVisionTasks']>>;

const MODEL_PATH = 'mediapipe/face_landmarker.task';
const WASM_PATH = 'mediapipe/wasm';
/** A video track that stays muted this long counts as a lost camera. */
const TRACK_MUTE_LOST_MS = 3000;

/**
 * MediaPipe FaceLandmarker pose source (SPEC 1.9 item 6, §1.6 sign convention).
 * Frames stay in this page. Nothing is stored or sent.
 */
export function createMediaPipePoseSource(opts: { useGpu: boolean }): PoseSource {
  let status: PoseStatus = 'idle';
  const statusSubs = new Set<(s: PoseStatus) => void>();
  const subs = new Set<(s: PoseSample) => void>();

  /** Bumped by stop(). A start() whose awaits resolve with an older value releases what it got. */
  let generation = 0;
  let session: Session | null = null;
  let current: Promise<void> | null = null;

  const setStatus = (next: PoseStatus): void => {
    status = next;
    statusSubs.forEach((cb) => cb(next));
  };

  const isLive = (s: Session): boolean => !s.released && s.gen === generation;

  /** Releases every resource of one session. Safe to call more than once. */
  const release = (s: Session): void => {
    s.released = true;
    if (s.timer !== undefined) {
      clearTimeout(s.timer);
      s.timer = undefined;
    }
    s.stream?.getTracks().forEach((t) => t.stop());
    s.stream = undefined;
    if (s.video) {
      s.video.srcObject = null;
      s.video.remove();
      s.video = undefined;
    }
    if (s.landmarker) {
      try {
        s.landmarker.close();
      } catch {
        /* already closed */
      }
      s.landmarker = undefined;
    }
  };

  const onHide = (): void => {
    source.stop();
  };

  const attachHideListeners = (): void => {
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
  };
  const detachHideListeners = (): void => {
    window.removeEventListener('pagehide', onHide);
    document.removeEventListener('visibilitychange', onVisibility);
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') source.stop();
  };

  /** Turns one detect result into a PoseSample. Frames are not kept. */
  const toSample = (result: FaceLandmarkerResult, t: number): PoseSample => {
    const face = result.faceLandmarks[0];
    if (!face) return { t, facePresent: false, yawDeg: 0, mouthLeft: 0, mouthRight: 0 };
    const matrix = result.facialTransformationMatrixes?.[0]?.data;
    const yawDeg = matrix ? yawFromMatrix(matrix) : yawFromLandmarks(face);
    const mouth = mouthFromBlendshapes(result.faceBlendshapes?.[0]?.categories ?? []);
    const sample: PoseSample = { t, facePresent: true, yawDeg, mouthLeft: mouth.mouthLeft, mouthRight: mouth.mouthRight };
    if (matrix) sample.pitchDeg = pitchFromMatrix(matrix);
    return sample;
  };

  const scheduleTick = (s: Session, delay: number): void => {
    if (!isLive(s)) return;
    s.timer = setTimeout(() => tick(s), delay);
  };

  const failLoop = (s: Session): void => {
    release(s);
    if (session === s) session = null;
    current = null;
    setStatus('error');
  };

  /** The system took the camera away (track ended, or muted for a long time). */
  const cameraLost = (s: Session): void => {
    if (!isLive(s)) return;
    release(s);
    if (session === s) session = null;
    current = null;
    setStatus('unavailable');
  };

  const watchTracks = (s: Session, stream: MediaStream): void => {
    stream.getVideoTracks().forEach((track) => {
      let muteTimer: ReturnType<typeof setTimeout> | undefined;
      track.addEventListener('ended', () => {
        clearTimeout(muteTimer);
        cameraLost(s);
      });
      track.addEventListener('mute', () => {
        clearTimeout(muteTimer);
        muteTimer = setTimeout(() => cameraLost(s), TRACK_MUTE_LOST_MS);
      });
      track.addEventListener('unmute', () => clearTimeout(muteTimer));
    });
  };

  const tick = (s: Session): void => {
    s.timer = undefined;
    if (!isLive(s)) return;
    const video = s.video;
    const landmarker = s.landmarker;
    const delay = s.faceSeen ? GESTURE_CONSTANTS.SAMPLE_INTERVAL_MS : GESTURE_CONSTANTS.SAMPLE_INTERVAL_NO_FACE_MS;
    if (!video || !landmarker || video.readyState < 2) {
      scheduleTick(s, delay);
      return;
    }
    try {
      const t = performance.now();
      const result = landmarker.detectForVideo(video, t);
      const sample = toSample(result, t);
      s.errors = 0;
      s.faceSeen = sample.facePresent;
      if (status !== 'running') setStatus('running');
      subs.forEach((cb) => cb(sample));
    } catch {
      s.errors += 1;
      if (s.errors >= 3) {
        failLoop(s);
        return;
      }
    }
    scheduleTick(s, s.faceSeen ? GESTURE_CONSTANTS.SAMPLE_INTERVAL_MS : GESTURE_CONSTANTS.SAMPLE_INTERVAL_NO_FACE_MS);
  };

  const createLandmarker = async (vision: Vision, fileset: Fileset): Promise<FaceLandmarker> => {
    const base = import.meta.env.BASE_URL;
    const options = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: base + MODEL_PATH, delegate },
      runningMode: 'VIDEO' as const,
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
    if (opts.useGpu) {
      try {
        return await vision.FaceLandmarker.createFromOptions(fileset, options('GPU'));
      } catch {
        /* the GPU failed: try the CPU once */
      }
    }
    return vision.FaceLandmarker.createFromOptions(fileset, options('CPU'));
  };

  /** One start attempt. Resolves true when the loop runs, false when the attempt ended. */
  const run = async (s: Session): Promise<boolean> => {
    const fail = (next: PoseStatus): boolean => {
      release(s);
      if (session === s) session = null;
      setStatus(next);
      return false;
    };

    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!md || typeof md.getUserMedia !== 'function') return fail('unavailable');

    let stream: MediaStream;
    try {
      stream = await md.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } },
      });
    } catch (err) {
      if (!isLive(s)) {
        release(s);
        return false;
      }
      const name = err instanceof DOMException ? err.name : '';
      return fail(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
    }
    s.stream = stream;
    if (!isLive(s)) {
      release(s);
      return false;
    }

    watchTracks(s, stream);

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.className = 'pose-video-hidden';
    video.style.position = 'fixed';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.srcObject = stream;
    document.body.appendChild(video);
    s.video = video;
    try {
      await video.play();
    } catch {
      if (!isLive(s)) {
        release(s);
        return false;
      }
      return fail('error');
    }
    if (!isLive(s)) {
      release(s);
      return false;
    }

    let vision: Vision;
    let fileset: Fileset;
    try {
      vision = await import('@mediapipe/tasks-vision');
      if (!isLive(s)) {
        release(s);
        return false;
      }
      fileset = await vision.FilesetResolver.forVisionTasks(import.meta.env.BASE_URL + WASM_PATH);
      if (!isLive(s)) {
        release(s);
        return false;
      }
      const landmarker = await createLandmarker(vision, fileset);
      s.landmarker = landmarker;
      if (!isLive(s)) {
        release(s);
        return false;
      }
    } catch {
      if (!isLive(s)) {
        release(s);
        return false;
      }
      return fail('error');
    }

    // Loop: setTimeout based, never a frame callback. Frames are not stored.
    scheduleTick(s, 0);
    return true;
  };

  const source: PoseSource = {
    start(): Promise<void> {
      if (current) return current;
      const gen = ++generation;
      const s: Session = { gen, released: false, errors: 0, faceSeen: false };
      session = s;
      setStatus('loading');
      attachHideListeners();
      const p: Promise<void> = run(s).then((ok) => {
        if (!ok && current === p) current = null;
      });
      current = p;
      return p;
    },

    stop(): void {
      generation += 1;
      current = null;
      const s = session;
      session = null;
      if (s) release(s);
      detachHideListeners();
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

    getVideoStream: () => (session?.stream ?? null),
  };

  return source;
}
