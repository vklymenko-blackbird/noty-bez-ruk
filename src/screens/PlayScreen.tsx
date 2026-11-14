import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type {
  AnnotSession,
  CropBox,
  GestureController,
  GestureSnapshot,
  NavAction,
  PdfDoc,
  ScoreMeta,
  ScreenProps,
  TurnDir,
  TurnPosition,
} from '../contracts';
import { setProbe } from '../app/testHook';
import { navigate } from '../app/router';
import { t } from '../i18n';
import { settings, useSettings } from '../settings';
import { storage } from '../storage';
import { openPdf } from '../pdf';
import { createPoseSource } from '../pose';
import { createGestureController } from '../gesture';
import CalibrationOverlay from '../gesture/CalibrationOverlay';
import GestureHud from '../gesture/GestureHud';
import { createAnnotSession } from '../annot';
import AnnotationLayer from '../annot/AnnotationLayer';
import AnnotationToolbar from '../annot/AnnotationToolbar';
import PageView from '../play/PageView';
import ControlsSheet from '../play/ControlsSheet';
import { clampPage, turnNext, turnPrev } from '../play';
import { attachKeyNav, attachPointerNav } from '../input';
import { createWakeKeeper } from '../wake';
import { Button, IconButton, Sheet, Spinner, toast } from '../ui';
import './Play.css';

const COACH_KEY = 'noty.coach.v1';
const COACH_MAX_SESSIONS = 3;
const COACH_MS = 4000;
const PULSE_MS = 900;
const OVERLAY_FADE_MS = 1000;
const SAVE_PAGE_DEBOUNCE_MS = 500;
const WAKE_HINT_KEY = 'noty.wakeHint';

type Pulse = 'end' | 'start' | null;

function readCoachCount(): number {
  try {
    const n = Number(localStorage.getItem(COACH_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeCoachCount(n: number): void {
  try {
    localStorage.setItem(COACH_KEY, String(n));
  } catch {
    /* storage may be blocked */
  }
}

/** LOAD: the score meta and the opened PDF. Navigates away when the score is missing or broken. */
function useScoreDoc(id: string, onReady: (meta: ScoreMeta) => void) {
  const [meta, setMeta] = useState<ScoreMeta | null>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    let cancelled = false;
    let opened: PdfDoc | null = null;
    setMeta(null);
    setDoc(null);
    (async () => {
      const m = await storage.getScore(id);
      if (cancelled) return;
      if (!m) {
        toast(t('error.not-found'), { kind: 'error' });
        navigate('/', { replace: true });
        return;
      }
      try {
        const data = await storage.getScoreData(id);
        if (cancelled) return;
        if (!data) throw new Error('no data');
        const d = await openPdf(data);
        if (cancelled) {
          void d.destroy();
          return;
        }
        opened = d;
        void storage.updateScore(id, { lastOpenedAt: Date.now() }).catch(() => undefined);
        readyRef.current(m);
        setMeta(m);
        setDoc(d);
      } catch {
        if (cancelled) return;
        toast(t('error.pdf-open-failed', { name: m.title }), { kind: 'error' });
        navigate('/score/' + id, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
      if (opened) void opened.destroy();
    };
  }, [id]);

  return { meta, setMeta, doc };
}

interface InputDeps {
  rootRef: { current: HTMLDivElement | null };
  ready: boolean;
  onTurn: (dir: TurnDir) => void;
  onMenu: () => void;
}

/** INPUT, WAKE: keys, tap, swipe and the screen wake lock. */
function usePlayInput({ rootRef, ready, onTurn, onMenu }: InputDeps) {
  const turnRef = useRef(onTurn);
  const menuRef = useRef(onMenu);
  turnRef.current = onTurn;
  menuRef.current = onMenu;

  useEffect(() => {
    const root = rootRef.current;
    if (!ready || !root) return;
    const onAction = (a: NavAction) => {
      if (a === 'menu') menuRef.current();
      else turnRef.current(a);
    };
    const offKeys = attachKeyNav(window, settings.get, onAction);
    const offPointer = attachPointerNav(root, onAction);
    return () => {
      offKeys();
      offPointer();
    };
  }, [rootRef, ready]);

  useEffect(() => {
    let gone = false;
    const keeper = createWakeKeeper();
    keeper
      .acquire()
      .then((how) => {
        if (gone || how === 'wakelock') return;
        try {
          if (sessionStorage.getItem(WAKE_HINT_KEY)) return;
          sessionStorage.setItem(WAKE_HINT_KEY, '1');
        } catch {
          /* show the hint anyway */
        }
        toast(t('play.wakeHint'), { durationMs: 8000 });
      })
      .catch(() => undefined);
    return () => {
      gone = true;
      keeper.release();
    };
  }, []);
}

interface GestureDeps {
  ready: boolean;
  gestureOn: boolean;
  paused: boolean;
  onTurn: (dir: TurnDir) => void;
}

/** GESTURES: owns the controller. Touch and keys never depend on it. */
function usePlayGestures({ ready, gestureOn, paused, onTurn }: GestureDeps) {
  const turnRef = useRef(onTurn);
  turnRef.current = onTurn;
  const skippedRef = useRef(false);
  const [cameraSkipped, setSkipped] = useState(false);
  const controller = useMemo<GestureController>(
    () =>
      createGestureController({
        pose: createPoseSource(),
        getSettings: settings.get,
        onTurn: (dir) => turnRef.current(dir),
      }),
    [],
  );
  const [snapshot, setSnapshot] = useState<GestureSnapshot>(() => controller.getSnapshot());

  useEffect(() => {
    setSnapshot(controller.getSnapshot());
    return controller.subscribe(() => setSnapshot(controller.getSnapshot()));
  }, [controller]);

  const safeStart = useCallback(() => {
    try {
      controller.start().catch(() => undefined);
    } catch {
      /* gestures are optional */
    }
  }, [controller]);

  const safeStop = useCallback(() => {
    try {
      controller.stop();
    } catch {
      /* ignore */
    }
  }, [controller]);

  useEffect(() => {
    if (ready && gestureOn && !skippedRef.current) safeStart();
    else safeStop();
  }, [ready, gestureOn, safeStart, safeStop]);

  useEffect(() => {
    try {
      controller.setPaused(paused);
    } catch {
      /* ignore */
    }
  }, [controller, paused]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') safeStop();
      else if (ready && gestureOn && !skippedRef.current) safeStart();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', safeStop);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', safeStop);
    };
  }, [ready, gestureOn, safeStart, safeStop]);

  useEffect(() => safeStop, [safeStop]);

  const skipCamera = useCallback(() => {
    skippedRef.current = true;
    setSkipped(true);
    safeStop();
  }, [safeStop]);

  const retry = useCallback(() => {
    safeStop();
    safeStart();
  }, [safeStart, safeStop]);

  return { controller, snapshot, cameraSkipped, skipCamera, retry };
}

export default function PlayScreen({ params }: ScreenProps) {
  const id = params.id ?? '';
  const s = useSettings();
  const rootRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<TurnPosition>({ page: 1, half: false });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [annotating, setAnnotating] = useState(false);
  const [pulse, setPulse] = useState<Pulse>(null);
  const [coach, setCoach] = useState(false);
  const [landscape, setLandscape] = useState(false);
  const coachDecided = useRef(false);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedPage = useRef(0);
  const session = useMemo<AnnotSession>(() => createAnnotSession(storage, id), [id]);

  const posRef = useRef(position);
  const blockedRef = useRef(false);
  const pageCountRef = useRef(0);
  blockedRef.current = sheetOpen || annotating || howOpen;

  const { meta, setMeta, doc } = useScoreDoc(id, (m) => {
    const start = { page: clampPage(m.lastPage, m.pageCount), half: false };
    posRef.current = start;
    savedPage.current = start.page;
    setPosition(start);
  });
  const ready = doc !== null && meta !== null;
  pageCountRef.current = doc?.pageCount ?? 0;

  const showPulse = useCallback((p: Exclude<Pulse, null>) => {
    clearTimeout(pulseTimer.current);
    setPulse(p);
    pulseTimer.current = setTimeout(() => setPulse(null), PULSE_MS);
  }, []);

  const turn = useCallback(
    (dir: TurnDir) => {
      const count = pageCountRef.current;
      if (blockedRef.current || count === 0) return;
      const halfOn = settings.get().halfPage;
      const r = dir === 'next' ? turnNext(posRef.current, count, halfOn) : turnPrev(posRef.current, count, halfOn);
      if (r.atEnd) showPulse('end');
      if (r.atStart) showPulse('start');
      posRef.current = r.pos;
      setPosition(r.pos);
    },
    [showPulse],
  );

  const openMenu = useCallback(() => {
    if (!blockedRef.current) setSheetOpen(true);
  }, []);

  usePlayInput({ rootRef, ready, onTurn: turn, onMenu: openMenu });
  const gestureOn = s.gesture !== 'off';
  const { controller, snapshot, cameraSkipped, skipCamera, retry } = usePlayGestures({
    ready,
    gestureOn,
    paused: sheetOpen || annotating,
    onTurn: turn,
  });

  // body class and landscape hint
  useEffect(() => {
    document.body.classList.add('is-playing');
    return () => document.body.classList.remove('is-playing');
  }, []);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(orientation: landscape)');
    const update = () => setLandscape(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  // save the last page (debounced) and on unmount
  const flushPage = useCallback(() => {
    clearTimeout(saveTimer.current);
    const page = posRef.current.page;
    if (!ready || page === savedPage.current) return;
    savedPage.current = page;
    void storage.updateScore(id, { lastPage: page }).catch(() => undefined);
  }, [id, ready]);
  const flushRef = useRef(flushPage);
  flushRef.current = flushPage;
  useEffect(() => {
    if (!ready) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushRef.current(), SAVE_PAGE_DEBOUNCE_MS);
  }, [ready, position.page]);
  useEffect(
    () => () => {
      flushRef.current();
      clearTimeout(saveTimer.current);
      clearTimeout(pulseTimer.current);
    },
    [],
  );

  // test probe
  const paper = meta?.paper ?? s.paper;
  const crop = meta?.crop ?? s.autoCrop;
  const probe = useRef({ position, pageCount: 0, annotating, sheetOpen, paper, crop });
  probe.current = { position, pageCount: doc?.pageCount ?? 0, annotating, sheetOpen, paper, crop };
  useEffect(() => {
    setProbe('play', () => {
      const p = probe.current;
      return { page: posRef.current.page, half: posRef.current.half, pageCount: p.pageCount, annotating: p.annotating, sheetOpen: p.sheetOpen, paper: p.paper, crop: p.crop };
    });
    return () => setProbe('play', null);
  }, []);

  // coach layer
  const status = snapshot.status;
  const cameraProblem = status === 'denied' || status === 'unavailable' || status === 'error';
  const phase = snapshot.state.phase;
  const calibrationOver = !gestureOn || cameraSkipped || cameraProblem || (phase !== 'idle' && phase !== 'calibrating');
  // The overlay shows «Готово» and fades for about 0.9 s after the calibration. The coach waits for that.
  const [overlayGone, setOverlayGone] = useState(false);
  useEffect(() => {
    if (!calibrationOver) {
      setOverlayGone(false);
      return;
    }
    const timer = setTimeout(() => setOverlayGone(true), gestureOn && !cameraSkipped && !cameraProblem ? OVERLAY_FADE_MS : 0);
    return () => clearTimeout(timer);
  }, [calibrationOver, gestureOn, cameraSkipped, cameraProblem]);
  const coachReady = ready && overlayGone;
  useEffect(() => {
    if (!coachReady || coachDecided.current) return;
    coachDecided.current = true;
    const n = readCoachCount();
    if (n >= COACH_MAX_SESSIONS) return;
    writeCoachCount(n + 1);
    setCoach(true);
  }, [coachReady]);
  useEffect(() => {
    if (!coach) return;
    const timer = setTimeout(() => setCoach(false), COACH_MS);
    return () => clearTimeout(timer);
  }, [coach]);

  // actions
  const patchMeta = useCallback(
    (patch: Partial<Pick<ScoreMeta, 'paper' | 'crop'>>) => {
      setMeta((m) => (m ? { ...m, ...patch } : m));
      void storage.updateScore(id, patch).catch(() => undefined);
    },
    [id, setMeta],
  );
  const onDividerChange = useCallback(
    (dividerRatio: number) => {
      void storage.updateScore(id, { dividerRatio }).catch(() => undefined);
    },
    [id],
  );
  const goToPage = useCallback((page: number) => {
    const next = { page: clampPage(page, pageCountRef.current), half: false };
    posRef.current = next;
    setPosition(next);
  }, []);
  const onHalfPage = useCallback((on: boolean) => {
    settings.set({ halfPage: on });
    const next = { page: posRef.current.page, half: false };
    posRef.current = next;
    setPosition(next);
  }, []);
  const onAnnotate = useCallback(() => {
    setSheetOpen(false);
    const next = { page: posRef.current.page, half: false };
    posRef.current = next;
    setPosition(next);
    setAnnotating(true);
  }, []);
  const onAnnotDone = useCallback(() => {
    session.commit().catch(() => undefined);
    setAnnotating(false);
  }, [session]);
  const onAnnotCancel = useCallback(() => {
    try {
      session.revert();
    } catch {
      /* ignore */
    }
    setAnnotating(false);
  }, [session]);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const onExit = useCallback(() => navigate('/score/' + id, { replace: true }), [id]);

  const renderOverlay = useCallback(
    (info: { page: number; crop: CropBox }) => (
      <AnnotationLayer
        session={session}
        page={info.page}
        crop={info.crop}
        editing={annotating}
        paper={paper}
        fingerDraw={s.fingerDraw}
      />
    ),
    [session, annotating, paper, s.fingerDraw],
  );

  const showBanner = gestureOn && !cameraSkipped && cameraProblem;

  return (
    <main class="screen" data-testid="screen-play">
      <div ref={rootRef} class="play-root" data-testid="play-root">
        {!ready ? (
          <div class="play-loading" data-nav-ignore>
            <Spinner />
            <span>{t('play.loading')}</span>
          </div>
        ) : (
          <PageView
            doc={doc}
            position={position}
            paper={paper}
            crop={crop}
            dividerRatio={meta.dividerRatio}
            onDividerChange={onDividerChange}
            renderOverlay={renderOverlay}
          />
        )}

        <GestureHud snapshot={snapshot} gesture={s.gesture} />
        <CalibrationOverlay snapshot={snapshot} stream={controller.getVideoStream()} onSkip={skipCamera} />

        {pulse ? (
          <div class="play-pulse" data-testid={pulse === 'end' ? 'play-end' : 'play-start'} role="status">
            {pulse === 'end' ? t('play.end') : t('play.start')}
          </div>
        ) : null}

        {landscape ? (
          <div class="play-rotate" data-testid="play-rotate-hint" data-nav-ignore>
            {t('play.rotate')}
          </div>
        ) : null}

        {showBanner ? (
          <div class="play-banner" data-testid="play-camera-banner" data-nav-ignore role="status">
            <span class="play-banner__text">{status === 'error' ? t('play.modelFailed') : t('play.cameraOff')}</span>
            <Button variant="ghost" onClick={retry} data-testid="play-camera-retry">
              {t('play.cameraRetry')}
            </Button>
            <Button variant="ghost" onClick={() => setHowOpen(true)} data-testid="play-camera-how">
              {t('play.cameraHow')}
            </Button>
            <IconButton icon="close" label={t('common.close')} onClick={skipCamera} data-testid="play-camera-close" />
          </div>
        ) : null}

        {coach && coachReady && phase !== 'calibrating' ? (
          <div class="play-coach" data-testid="play-coach" data-nav-ignore onClick={() => setCoach(false)}>
            <div class="play-coach__cols">
              <span>{t('play.coach.prev')}</span>
              <span>{t('play.coach.menu')}</span>
              <span>{t('play.coach.next')}</span>
            </div>
            <p class="play-coach__touch">{t('play.coach.touch')}</p>
          </div>
        ) : null}

        {annotating ? <AnnotationToolbar session={session} page={position.page} onDone={onAnnotDone} onCancel={onAnnotCancel} /> : null}
      </div>

      <Sheet open={howOpen} onClose={() => setHowOpen(false)} title={t('play.cameraHow')}>
        <p>{t('play.cameraHow.body')}</p>
      </Sheet>

      <ControlsSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={meta?.title ?? ''}
        page={position.page}
        pageCount={doc?.pageCount ?? 0}
        onGoToPage={goToPage}
        halfPage={s.halfPage}
        onHalfPage={onHalfPage}
        paper={paper}
        onPaper={(p) => patchMeta({ paper: p })}
        crop={crop}
        onCrop={(on) => patchMeta({ crop: on })}
        gesture={s.gesture}
        cameraStatus={status}
        yawThresholdDeg={s.yawThresholdDeg}
        onYawThreshold={(deg) => settings.set({ yawThresholdDeg: deg })}
        flip={s.flipDirection}
        onFlip={(on) => settings.set({ flipDirection: on })}
        onRecalibrate={() => controller.recalibrate()}
        onAnnotate={onAnnotate}
        onExit={onExit}
      />
    </main>
  );
}
