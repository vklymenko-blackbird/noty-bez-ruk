import type { GestureHudProps, GestureSnapshot } from '../contracts';
import { t } from '../i18n';
import './gesture.css';

const RING_R = 11;
const RING_C = 2 * Math.PI * RING_R;

type DotState = 'paused' | 'lost' | 'arming' | 'seen';

const DOT_LABEL = {
  paused: 'play.facePaused',
  lost: 'play.faceLost',
  arming: 'play.faceSeen',
  seen: 'play.faceSeen',
} as const;

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

function dotStateOf(snapshot: GestureSnapshot): DotState {
  const { status, state } = snapshot;
  if (status !== 'running' || state.paused || state.phase === 'idle') return 'paused';
  if (state.phase === 'no-face' || !state.facePresent) return 'lost';
  if (state.phase === 'arming') return 'arming';
  return 'seen';
}

export default function GestureHud({ snapshot, gesture }: GestureHudProps) {
  if (gesture === 'off') return null;
  const { state } = snapshot;
  const dot = dotStateOf(snapshot);
  const cooling = state.phase === 'cooldown';

  return (
    <div class="gesture-hud">
      <div class="gesture-hud__dot" data-testid="hud-dot" data-state={dot} role="status" aria-label={t(DOT_LABEL[dot])}>
        {dot === 'arming' ? (
          <svg class="gesture-hud__ring" viewBox="0 0 24 24" aria-hidden="true">
            <circle
              class="gesture-hud__ring-bar"
              cx="12"
              cy="12"
              r={RING_R}
              stroke-dasharray={RING_C}
              stroke-dashoffset={RING_C * (1 - clamp01(state.armProgress))}
            />
          </svg>
        ) : null}
      </div>
      {cooling ? (
        <div
          class="gesture-hud__cooldown"
          data-testid="hud-cooldown"
          style={{ width: `${(1 - clamp01(state.cooldownProgress)) * 100}%` }}
        />
      ) : null}
    </div>
  );
}
