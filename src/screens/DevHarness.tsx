import { useEffect, useMemo, useState } from 'preact/hooks';
import type { AnnotSession, GestureController, GestureKind, PaperTheme, PdfDoc, PoseStatus, ScreenProps, TurnDir, TurnPosition } from '../contracts';
import { PAPER_THEMES } from '../paper';
import { openPdf } from '../pdf';
import { storage } from '../storage';
import { turnNext, turnPrev } from '../play';
import { createGestureController } from '../gesture';
import { createPoseSource } from '../pose';
import { createAnnotSession } from '../annot';
import { settings } from '../settings';
import { setProbe } from '../app/testHook';
import { Button } from '../ui';
import './DevHarness.css';
import PageView from '../play/PageView';
import ControlsSheet from '../play/ControlsSheet';
import AnnotationLayer from '../annot/AnnotationLayer';
import AnnotationToolbar from '../annot/AnnotationToolbar';
import CalibrationOverlay from '../gesture/CalibrationOverlay';
import GestureHud from '../gesture/GestureHud';

function useDoc(id: string | undefined): PdfDoc | null {
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  useEffect(() => {
    let alive = true;
    if (!id) return;
    (async () => {
      const data = await storage.getScoreData(id);
      if (!data || !alive) return;
      const d = await openPdf(data);
      if (alive) setDoc(d);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);
  return doc;
}

function PageViewHarness({ id }: { id: string }) {
  const doc = useDoc(id);
  const [pos, setPos] = useState<TurnPosition>({ page: 1, half: false });
  const [paper, setPaper] = useState<PaperTheme>('ivory');
  const [crop, setCrop] = useState(true);
  const [ratio, setRatio] = useState(0.5);
  const pageCount = doc?.pageCount ?? 1;
  return (
    <div class="dev-harness" data-testid="dev-pageview">
      {doc ? <PageView doc={doc} position={pos} paper={paper} crop={crop} dividerRatio={ratio} onDividerChange={setRatio} /> : null}
      <div class="dev-bar" data-nav-ignore>
        <Button onClick={() => setPos((p) => turnPrev(p, pageCount, true).pos)} data-testid="dev-prev">prev</Button>
        <Button onClick={() => setPos((p) => turnNext(p, pageCount, true).pos)} data-testid="dev-next">next</Button>
        {PAPER_THEMES.map((p) => (
          <Button key={p} onClick={() => setPaper(p)} data-testid={`dev-paper-${p}`}>{p}</Button>
        ))}
        <Button onClick={() => setCrop((c) => !c)} data-testid="dev-crop">crop</Button>
        <span data-testid="dev-pos">{`${pos.page}:${pos.half}`}</span>
      </div>
    </div>
  );
}

function AnnotHarness({ id }: { id: string }) {
  const doc = useDoc(id);
  const session: AnnotSession = useMemo(() => createAnnotSession(storage, id), [id]);
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(0);
  useEffect(() => {
    session.load(1).catch(() => {});
    const update = () => setCount(session.getMarks(1).length);
    update();
    return session.subscribe(update);
  }, [session]);
  return (
    <div class="dev-harness" data-testid="dev-annot">
      {doc ? (
        <PageView
          doc={doc}
          position={{ page: 1, half: false }}
          paper="ivory"
          crop={false}
          dividerRatio={0.5}
          renderOverlay={(info) => (
            <AnnotationLayer session={session} page={info.page} crop={info.crop} editing paper="ivory" fingerDraw />
          )}
        />
      ) : null}
      <AnnotationToolbar session={session} page={1} onDone={() => setDone((n) => n + 1)} onCancel={() => session.revert()} />
      <div class="dev-bar" data-nav-ignore>
        <span data-testid="dev-marks">{count}</span>
        <span data-testid="dev-done-count">{done}</span>
      </div>
    </div>
  );
}

function GestureHarness() {
  const [turns, setTurns] = useState<TurnDir[]>([]);
  const [, force] = useState(0);
  const ctl: GestureController = useMemo(
    () =>
      createGestureController({
        pose: createPoseSource(),
        getSettings: () => settings.get(),
        onTurn: (d) => setTurns((t) => [...t, d]),
      }),
    [],
  );
  useEffect(() => {
    setProbe('gesture', () => ctl.getSnapshot());
    const off = ctl.subscribe(() => force((n) => n + 1));
    ctl.start().catch(() => {});
    return () => {
      off();
      ctl.stop();
      setProbe('gesture', null);
    };
  }, [ctl]);
  const snapshot = ctl.getSnapshot();
  const gesture: GestureKind = settings.get().gesture;
  return (
    <div class="dev-harness" data-testid="dev-gesture">
      <CalibrationOverlay snapshot={snapshot} stream={ctl.getVideoStream()} onSkip={() => {}} />
      <GestureHud snapshot={snapshot} gesture={gesture} />
      <div class="dev-bar" data-nav-ignore>
        <span data-testid="dev-turns">{turns.join(',')}</span>
      </div>
    </div>
  );
}

function ControlsHarness() {
  const [last, setLast] = useState('');
  const [page, setPage] = useState(1);
  const [half, setHalf] = useState(true);
  const [paper, setPaper] = useState<PaperTheme>('ivory');
  const [crop, setCrop] = useState(true);
  const [yaw, setYaw] = useState(20);
  const status: PoseStatus = 'running';
  const rec = (name: string, value: unknown) => setLast(`${name}:${String(value)}`);
  return (
    <div class="dev-harness" data-testid="dev-controls">
      <ControlsSheet
        open
        onClose={() => rec('close', '')}
        title="Dev"
        page={page}
        pageCount={12}
        onGoToPage={(p) => { setPage(p); rec('page', p); }}
        halfPage={half}
        onHalfPage={(v) => { setHalf(v); rec('half', v); }}
        paper={paper}
        onPaper={(v) => { setPaper(v); rec('paper', v); }}
        crop={crop}
        onCrop={(v) => { setCrop(v); rec('crop', v); }}
        gesture="head"
        cameraStatus={status}
        yawThresholdDeg={yaw}
        onYawThreshold={(v) => { setYaw(v); rec('yaw', v); }}
        onRecalibrate={() => rec('recalibrate', '')}
        onAnnotate={() => rec('annotate', '')}
        onExit={() => rec('exit', '')}
      />
      <span class="dev-last" data-testid="dev-last">{last}</span>
    </div>
  );
}

/** Test mode only. Hosts one component against the stubs or the real parts. */
export default function DevHarness({ params }: ScreenProps) {
  const id = params.id ?? '';
  switch (params.what) {
    case 'pageview':
      return <PageViewHarness id={id} />;
    case 'annot':
      return <AnnotHarness id={id} />;
    case 'gesture':
      return <GestureHarness />;
    case 'controls':
      return <ControlsHarness />;
    default:
      return <main class="screen" data-testid="dev-unknown">?</main>;
  }
}
