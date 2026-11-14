import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { CalibrationOverlayProps, GestureKind, GesturePhase } from '../contracts';
import { t } from '../i18n';
import { useSettings } from '../settings';
import { Button, Icon, ProgressRing, Spinner } from '../ui';
import './gesture.css';

/** Time the «Готово» text stays after calibration ends (SPEC 1.4). */
const DONE_MS = 700;
/** Fade length, the --dur-1 token. */
const FADE_MS = 160;

type DoneStage = 'none' | 'done' | 'fading';

/** Statuses in which the overlay never shows. */
const HIDDEN_STATUSES = new Set(['idle', 'denied', 'unavailable', 'error']);

const HINT_KEYS = {
  head: 'calib.hint.head',
  mouth: 'calib.hint.mouth',
} as const;

function hintFor(gesture: GestureKind, phase: GesturePhase): (typeof HINT_KEYS)[keyof typeof HINT_KEYS] | null {
  if (phase !== 'calibrating' || gesture === 'off') return null;
  return gesture === 'mouth' ? HINT_KEYS.mouth : HINT_KEYS.head;
}

export default function CalibrationOverlay({ snapshot, stream, onSkip }: CalibrationOverlayProps) {
  const { status, state } = snapshot;
  const { phase } = state;
  const gesture = useSettings().gesture;

  const [doneStage, setDoneStage] = useState<DoneStage>('none');
  const prevPhase = useRef<GesturePhase>(phase);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Leaving 'calibrating' starts the done sequence. Layout effect, so the overlay does not blink.
  useLayoutEffect(() => {
    const was = prevPhase.current;
    prevPhase.current = phase;
    if (was === 'calibrating' && phase !== 'calibrating') setDoneStage('done');
    else if (phase === 'calibrating') setDoneStage('none');
  }, [phase]);

  useEffect(() => {
    if (doneStage === 'none') return undefined;
    const id = window.setTimeout(
      () => setDoneStage(doneStage === 'done' ? 'fading' : 'none'),
      doneStage === 'done' ? DONE_MS : FADE_MS,
    );
    return () => window.clearTimeout(id);
  }, [doneStage]);

  const live = status === 'loading' || phase === 'calibrating';
  const showingDone = !live;
  const showVideo = !showingDone && stream !== null;

  // The video mounts with the stream and again after the done sequence, so it is re-attached on both.
  useLayoutEffect(() => {
    const el = videoRef.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream, showVideo]);

  if (HIDDEN_STATUSES.has(status)) return null;
  if (!live && doneStage === 'none') return null;

  const starting = status === 'loading';
  const faceSeen = state.facePresent;
  const title = starting
    ? t('calib.starting')
    : showingDone
      ? t('calib.done')
      : faceSeen
        ? t('calib.look')
        : t('calib.noFace');
  const hint = starting ? null : hintFor(gesture, phase);
  const ringValue = showingDone ? 1 : starting ? 0 : state.calibrationProgress;

  const cls = ['calib', doneStage === 'fading' ? 'calib--out' : ''].filter(Boolean).join(' ');

  return (
    <div class={cls} data-testid="calib-overlay" data-nav-ignore="">
      <ProgressRing value={ringValue} size={240}>
        <div class="calib__oval">
          {showingDone ? <Icon name="check" size={48} class="calib__done-icon" /> : null}
          {!showingDone && showVideo ? <video class="calib__video" ref={videoRef} muted playsInline autoPlay /> : null}
          {!showingDone && !showVideo ? <Icon name="camera" size={40} /> : null}
        </div>
      </ProgressRing>
      <div role="status" class="calib__starting">
        {starting ? <Spinner size={20} /> : null}
        <p class="calib__title">{title}</p>
      </div>
      {hint ? <p class="calib__hint">{t(hint)}</p> : null}
      <Button variant="ghost" data-testid="calib-skip" onClick={() => onSkip()}>
        {t('calib.skip')}
      </Button>
    </div>
  );
}
