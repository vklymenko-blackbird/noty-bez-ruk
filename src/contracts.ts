import type { ComponentChildren } from 'preact';

// ---------- basics ----------
export type ScoreId = string;
export type TurnDir = 'next' | 'prev';
export type PaperTheme = 'ivory' | 'sepia' | 'night' | 'contrast' | 'plain';
export type AppTheme = 'auto' | 'light' | 'dark';
export type GestureKind = 'head' | 'mouth' | 'off';
export type LibrarySort = 'recent' | 'title' | 'added';

export type AppErrorCode =
  | 'not-pdf' | 'too-large' | 'pdf-open-failed' | 'storage-full' | 'not-found'
  | 'network' | 'offline' | 'bad-response' | 'aborted'
  | 'camera-denied' | 'camera-unavailable' | 'model-load-failed';

export class AppError extends Error {
  readonly code: AppErrorCode;
  constructor(code: AppErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
  }
}

export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;

// ---------- settings ----------
export interface Settings {
  version: 1;
  gesture: GestureKind;
  yawThresholdDeg: number;
  holdMs: number;
  cooldownMs: number;
  mouthThreshold: number;
  flipDirection: boolean;
  halfPage: boolean;
  paper: PaperTheme;
  autoCrop: boolean;
  appTheme: AppTheme;
  fingerDraw: boolean;
  keysNext: string[];
  keysPrev: string[];
  useGpu: boolean;
  onboardingDone: boolean;
  librarySort: LibrarySort;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  gesture: 'head',
  yawThresholdDeg: 20,
  holdMs: 500,
  cooldownMs: 1500,
  mouthThreshold: 0.5,
  flipDirection: false,
  halfPage: true,
  paper: 'ivory',
  autoCrop: true,
  appTheme: 'auto',
  fingerDraw: false,
  keysNext: ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'],
  keysPrev: ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'],
  useGpu: false,
  onboardingDone: false,
  librarySort: 'recent',
};

export const SETTING_LIMITS = {
  yawThresholdDeg: { min: 12, max: 35, step: 1 },
  holdMs: { min: 300, max: 1000, step: 50 },
  cooldownMs: { min: 1000, max: 2500, step: 100 },
  mouthThreshold: { min: 0.3, max: 0.8, step: 0.05 },
} as const;

export interface SettingsStore {
  get(): Settings;
  set(patch: Partial<Settings>): void;
  reset(): void;
  subscribe(cb: (s: Settings) => void): () => void;
}

// ---------- library and storage ----------
export interface ScoreOrigin {
  kind: 'file' | 'catalog' | 'commons';
  sourceName: string;        // 'Файл' | 'Wikimedia Commons'
  license: string | null;    // for example 'Public domain'
  pageUrl: string | null;    // attribution page
  fileUrl: string | null;
}

export interface ScoreMeta {
  id: ScoreId;
  title: string;
  composer: string;          // '' when unknown
  detail: string;            // opus or key, '' when unknown
  pageCount: number;
  sizeBytes: number;
  addedAt: number;           // epoch ms
  lastOpenedAt: number;      // epoch ms, 0 = never opened
  lastPage: number;          // 1-based
  paper: PaperTheme | null;  // null = use Settings.paper
  crop: boolean | null;      // null = use Settings.autoCrop
  dividerRatio: number;      // 0.3..0.7, default 0.5
  origin: ScoreOrigin;
}

export interface NewScore {
  title: string;
  composer?: string;
  detail?: string;
  pageCount: number;
  origin: ScoreOrigin;
}

export type ScorePatch = Partial<
  Pick<ScoreMeta, 'title' | 'composer' | 'detail' | 'lastOpenedAt' | 'lastPage' | 'paper' | 'crop' | 'dividerRatio'>
>;

export interface StorageEstimate {
  usageBytes: number | null;
  quotaBytes: number | null;
  persisted: boolean;
  volatile?: boolean;   // true when the data lives only in memory and is lost on reload
}

export interface StorageApi {
  listScores(): Promise<ScoreMeta[]>;                       // any order
  getScore(id: ScoreId): Promise<ScoreMeta | null>;
  getScoreData(id: ScoreId): Promise<ArrayBuffer | null>;   // a fresh copy each call
  /** Atomic. Throws AppError('storage-full') on quota errors and leaves no partial record. */
  addScore(input: NewScore, data: ArrayBuffer): Promise<ScoreMeta>;
  /** Throws AppError('not-found'). */
  updateScore(id: ScoreId, patch: ScorePatch): Promise<ScoreMeta>;
  /** Removes the meta, the file and all marks. No error when the id is unknown. */
  deleteScore(id: ScoreId): Promise<void>;
  getMarks(id: ScoreId, page: number): Promise<Mark[]>;     // [] when none
  setMarks(id: ScoreId, page: number, marks: Mark[]): Promise<void>; // [] deletes the record
  estimate(): Promise<StorageEstimate>;
  requestPersist(): Promise<boolean>;
  /** Fires after every add, update and delete. */
  subscribe(cb: () => void): () => void;
}

// ---------- pdf ----------
/** Fractions of the full page, 0..1. */
export interface CropBox { x: number; y: number; w: number; h: number }
export const FULL_PAGE: CropBox = { x: 0, y: 0, w: 1, h: 1 };

export interface RenderOptions {
  cssWidth: number;   // target width of the (cropped) page in CSS px
  dpr: number;        // device pixel ratio to use (callers pass min(devicePixelRatio, 2))
  crop?: CropBox;     // default FULL_PAGE
}

export interface PdfDoc {
  readonly pageCount: number;
  /** Size in PDF points with the page rotation applied. */
  getPageSize(page: number): Promise<{ width: number; height: number }>;
  /** A new canvas with only the crop region. White background. No CSS size is set. */
  renderPage(page: number, opts: RenderOptions): Promise<HTMLCanvasElement>;
  destroy(): Promise<void>;
}

export interface PageCache {
  get(page: number, opts: RenderOptions): Promise<HTMLCanvasElement>;
  /** Pages that must not be evicted (they are on screen). */
  setVisible(pages: number[]): void;
  /** Render in the background; errors are swallowed. */
  prefetch(page: number, opts: RenderOptions): void;
  clear(): void;
}

// ---------- pose and gesture ----------
export interface PoseSample {
  t: number;            // ms, monotonic
  facePresent: boolean;
  yawDeg: number;       // + = the user's head turned to the user's own right
  mouthLeft: number;    // 0..1, mouth pulled to the user's own left
  mouthRight: number;   // 0..1, mouth pulled to the user's own right
  pitchDeg?: number;    // head pitch in degrees; optional; the engine uses only its change from the calibrated value
}

export type PoseStatus = 'idle' | 'loading' | 'running' | 'denied' | 'unavailable' | 'error';

export interface PoseSource {
  start(): Promise<void>;           // never rejects; failures become a status; may resolve before the status is 'running'
  stop(): void;                     // stops camera tracks; status 'idle'
  getStatus(): PoseStatus;
  subscribe(cb: (s: PoseSample) => void): () => void;
  onStatus(cb: (s: PoseStatus) => void): () => void;
  getVideoStream(): MediaStream | null;   // for the calibration preview
}

export interface InjectedPoseSource extends PoseSource {
  push(sample: PoseSample): void;
  /** Pushes all samples synchronously. Timestamps are shifted to stay monotonic. */
  replay(samples: PoseSample[]): void;
}

export type GesturePhase =
  | 'idle' | 'calibrating' | 'neutral' | 'arming' | 'cooldown' | 'wait-neutral' | 'no-face';

export interface GestureConfig {
  kind: 'head' | 'mouth';
  yawThresholdDeg: number;
  holdMs: number;
  cooldownMs: number;
  mouthThreshold: number;
  flip: boolean;
}

export const GESTURE_CONSTANTS = {
  NEUTRAL_DEG: 8,
  REARM_MS: 200,
  ARM_HYSTERESIS_DEG: 3,
  CALIBRATION_MS: 2000,
  CALIBRATION_MIN_SAMPLES: 5,
  CALIBRATION_MIN_FACE_RATIO: 0.5,
  EMA_ALPHA: 0.5,
  FACE_LOST_MS: 400,
  GAP_RESET_MS: 1000,
  DRIFT_ALPHA: 0.02,
  DRIFT_MAX_DEG: 5,
  MOUTH_OTHER_MAX: 0.25,
  MOUTH_HYSTERESIS: 0.1,
  SAMPLE_INTERVAL_MS: 100,
  SAMPLE_INTERVAL_NO_FACE_MS: 200,
} as const;

export type GestureEvent =
  | { type: 'turn'; dir: TurnDir; t: number }
  | { type: 'calibrated'; neutralYawDeg: number; t: number }
  | { type: 'calibration-failed'; t: number }
  | { type: 'face'; present: boolean; t: number };

export interface GestureState {
  phase: GesturePhase;
  dir: TurnDir | null;            // set in 'arming'
  armProgress: number;            // 0..1
  cooldownProgress: number;       // 0..1
  calibrationProgress: number;    // 0..1
  facePresent: boolean;
  relYawDeg: number;
  neutralYawDeg: number | null;
  paused: boolean;
}

export interface GestureEngine {
  push(sample: PoseSample): GestureEvent[];
  calibrate(): void;
  setConfig(config: GestureConfig): void;
  setPaused(paused: boolean): void;
  getState(): GestureState;
  reset(): void;
}

export interface GestureControllerDeps {
  pose: PoseSource;
  getSettings(): Settings;
  onTurn(dir: TurnDir): void;
}

export interface GestureSnapshot { status: PoseStatus; state: GestureState }

export interface GestureController {
  start(): Promise<void>;
  stop(): void;
  recalibrate(): void;
  setPaused(paused: boolean): void;
  getSnapshot(): GestureSnapshot;
  subscribe(cb: () => void): () => void;   // fires on every sample and status change
  getVideoStream(): MediaStream | null;
}

// ---------- turning and input ----------
export interface TurnPosition { page: number; half: boolean }
export interface TurnResult { pos: TurnPosition; changed: boolean; atEnd: boolean; atStart: boolean }
export type NavAction = 'next' | 'prev' | 'menu';

export interface WakeKeeper {
  /** Keeps the screen on. Resolves with the method that worked. Re-acquires on visibilitychange. */
  acquire(): Promise<'wakelock' | 'video' | 'none'>;
  release(): void;
}

// ---------- annotations ----------
export type PenColor = 'ink' | 'burgundy' | 'blue' | 'highlight';
export type AnnotTool = 'pen' | 'highlighter' | 'eraser' | 'stamp';

export interface StrokeMark {
  kind: 'stroke';
  id: string;
  color: PenColor;
  width: number;        // fraction of the page width, 0.001..0.05
  points: number[];     // flat [x0, y0, x1, y1, ...], full-page coordinates 0..1, max 4000 numbers
}
export interface StampMark {
  kind: 'stamp';
  id: string;
  digit: 1 | 2 | 3 | 4 | 5;
  x: number;            // centre, 0..1
  y: number;
  size: number;         // glyph height as a fraction of the page width, default 0.03
  color: PenColor;
}
export type Mark = StrokeMark | StampMark;

export const PEN_WIDTH = 0.004;
export const HIGHLIGHTER_WIDTH = 0.02;
export const STAMP_SIZE = 0.03;
export const ERASER_RADIUS = 0.015;
export const MAX_MARKS_PER_PAGE = 2000;

export interface AnnotToolState { tool: AnnotTool; color: PenColor; stampDigit: 1 | 2 | 3 | 4 | 5 }

export interface AnnotSession {
  getTool(): AnnotToolState;
  setTool(patch: Partial<AnnotToolState>): void;
  /** Loads the marks of a page from storage. Safe to call many times. */
  load(page: number): Promise<void>;
  getMarks(page: number): Mark[];           // [] before load
  addMark(page: number, mark: Mark): void;
  /** Removes every mark that touches the circle. Returns true when something was removed. */
  eraseAt(page: number, x: number, y: number, radius: number): boolean;
  undo(page: number): void;
  redo(page: number): void;
  canUndo(page: number): boolean;
  canRedo(page: number): boolean;
  clearPage(page: number): void;            // undoable
  isDirty(): boolean;
  commit(): Promise<void>;                  // saves all dirty pages
  revert(): void;                           // back to the last committed state
  subscribe(cb: () => void): () => void;
}

// ---------- score sources ----------
export interface ScoreHit {
  id: string;                 // unique within a result list
  source: 'catalog' | 'commons';
  title: string;
  composer: string;
  detail: string;             // opus, key; '' when unknown
  license: string;
  pageUrl: string;            // attribution / "open source" link
  fileUrl: string | null;     // null = cannot be added in the app (link-out only)
  sizeBytes: number | null;
  pages: number | null;
}

export interface CatalogEntry {
  id: string;
  title: string;              // original or English title
  titleUk: string;
  aliases: string[];
  composer: string;           // Latin, "Ludwig van Beethoven"
  composerUk: string;         // "Людвіг ван Бетховен"
  detail: string;             // "Op. 27 No. 2"
  fileUrl: string | null;
  pageUrl: string | null;
  license: string | null;
  sizeBytes: number | null;
  pages: number | null;
}

export interface LinkOut { id: 'imslp' | 'commons'; label: string; url: string }

export type DownloadProgress = (receivedBytes: number, totalBytes: number | null) => void;

// ---------- component props ----------
export interface ScreenProps { params: Record<string, string> }

export interface CoverProps {
  title: string;
  composer: string;
  detail?: string;
  size?: 'sm' | 'md' | 'lg';   // 120 / 200 / 300 px wide, ratio 3:4
  class?: string;
}

export interface PageOverlayInfo { page: number; crop: CropBox }

export interface PageViewProps {
  doc: PdfDoc;
  position: TurnPosition;
  paper: PaperTheme;
  crop: boolean;
  dividerRatio: number;                               // 0.3..0.7
  onDividerChange?: (ratio: number) => void;
  /** Rendered inside each page box, exactly over the page. */
  renderOverlay?: (info: PageOverlayInfo) => ComponentChildren;
}

export interface CalibrationOverlayProps {
  snapshot: GestureSnapshot;
  stream: MediaStream | null;
  onSkip: () => void;          // "Грати без камери"
}

export interface GestureHudProps { snapshot: GestureSnapshot; gesture: GestureKind }

export interface AnnotationLayerProps {
  session: AnnotSession;
  page: number;
  crop: CropBox;
  editing: boolean;
  paper: PaperTheme;
  fingerDraw: boolean;
}

export interface AnnotationToolbarProps {
  session: AnnotSession;
  page: number;
  onDone: () => void;          // ✓
  onCancel: () => void;        // ✕
}

export interface ControlsSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  page: number;
  pageCount: number;
  onGoToPage: (page: number) => void;
  halfPage: boolean;
  onHalfPage: (on: boolean) => void;
  paper: PaperTheme;
  onPaper: (paper: PaperTheme) => void;
  crop: boolean;
  onCrop: (on: boolean) => void;
  gesture: GestureKind;
  cameraStatus: PoseStatus;
  yawThresholdDeg: number;
  onYawThreshold: (deg: number) => void;
  flip: boolean;
  onFlip: (on: boolean) => void;
  onRecalibrate: () => void;
  onAnnotate: () => void;
  onExit: () => void;
}
