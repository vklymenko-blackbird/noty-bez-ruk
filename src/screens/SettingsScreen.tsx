import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import type { ScreenProps, GestureKind, PaperTheme, AppTheme, Settings, StorageEstimate } from '../contracts';
import { DEFAULT_SETTINGS, SETTING_LIMITS } from '../contracts';
import {
  Button,
  Chip,
  ConfirmSheet,
  Segmented,
  SettingsGroup,
  Slider,
  Switch,
  TopBar,
} from '../ui';
import { sizeText } from '../i18n/format';
import { t, uk, type StringKey } from '../i18n';
import { navigate } from '../app/router';
import { settings, useSettings } from '../settings';
import { storage } from '../storage';
import './Settings.css';

type PedalDir = 'next' | 'prev';

const GESTURES: GestureKind[] = ['head', 'mouth', 'off'];
const THEMES: AppTheme[] = ['auto', 'light', 'dark'];
const PAPER_THEMES: PaperTheme[] = ['ivory', 'sepia', 'night', 'contrast', 'plain'];

export { sizeText };

function secText(ms: number): string {
  return t('settings.hold.value', { sec: (ms / 1000).toFixed(1).replace('.', ',') });
}

/** A friendly name for a key code. Letters show in upper case. Unknown keys show as they are. */
export function keyLabel(key: string): string {
  const named = `settings.key.${key === ' ' ? 'Space' : key}`;
  if (named in uk) return uk[named as StringKey];
  return key.length === 1 ? key.toUpperCase() : key;
}

/** Keys of one pedal direction, shown as chips. A tap on a chip removes the key. */
function PedalRow({
  dir,
  keys,
  learning,
  onRemove,
  onLearn,
}: {
  dir: PedalDir;
  keys: string[];
  learning: boolean;
  onRemove: (key: string) => void;
  onLearn: () => void;
}) {
  const rowTestId = `set-keys-${dir}`;
  const title = dir === 'next' ? t('settings.pedal.next') : t('settings.pedal.prev');
  return (
    <div class="set-pedal-row" data-testid={rowTestId}>
      <div class="set-pedal-row__head">
        <span class="set-pedal-row__title">{title}</span>
        <Button
          variant="secondary"
          onClick={onLearn}
          data-testid={`set-learn-${dir}`}
        >
          {learning ? t('settings.pedal.press') : t('settings.pedal.learn')}
        </Button>
      </div>
      <div class="set-pedal-row__chips">
        {keys.length === 0 ? (
          <span class="set-pedal-row__none" data-testid={`${rowTestId}-none`}>
            {t('settings.pedal.noKeys')}
          </span>
        ) : null}
        {keys.map((key) => (
          <Chip key={key} selected onClick={() => onRemove(key)} data-testid={`${rowTestId}-chip`}>
            {keyLabel(key)}
          </Chip>
        ))}
      </div>
    </div>
  );
}

export default function SettingsScreen(_props: ScreenProps) {
  const s = useSettings();
  const [learning, setLearning] = useState<PedalDir | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);

  useEffect(() => {
    let alive = true;
    storage
      .estimate()
      .then((e) => {
        if (alive) setEstimate(e);
      })
      .catch(() => {
        if (alive) setEstimate({ usageBytes: null, quotaBytes: null, persisted: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  // Learn mode: the next key press (capture phase) goes to the chosen list.
  // Layout effect: the listener is attached before the browser can paint the new state.
  useLayoutEffect(() => {
    if (learning === null) return;
    const dir = learning;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab') return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        setLearning(null);
        return;
      }
      const cur = settings.get();
      const own = dir === 'next' ? cur.keysNext : cur.keysPrev;
      const other = dir === 'next' ? cur.keysPrev : cur.keysNext;
      const key = event.key;
      const patch: Partial<Settings> = dir === 'next'
        ? { keysNext: own.includes(key) ? own : [...own, key], keysPrev: other.filter((k) => k !== key) }
        : { keysPrev: own.includes(key) ? own : [...own, key], keysNext: other.filter((k) => k !== key) };
      settings.set(patch);
      setLearning(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [learning]);

  const removeKey = (dir: PedalDir, key: string) => {
    if (dir === 'next') settings.set({ keysNext: s.keysNext.filter((k) => k !== key) });
    else settings.set({ keysPrev: s.keysPrev.filter((k) => k !== key) });
  };

  const sensitivityHidden = s.gesture === 'off';

  return (
    <main class="screen" data-testid="screen-settings">
      <div class="screen-inner set-screen">
        <TopBar title={t('settings.title')} back="/" serif />

        <SettingsGroup title={t('settings.gesture')} data-testid="set-group-gesture">
          <div class="set-block">
            <Segmented
              label={t('settings.gesture')}
              data-testid="set-gesture"
              value={s.gesture}
              options={GESTURES.map((g) => ({ value: g, label: t(`settings.gesture.${g}`) }))}
              onChange={(v) => settings.set({ gesture: v as GestureKind })}
            />
            <p class="set-hint">{t(`settings.gesture.hint.${s.gesture}`)}</p>
          </div>
          <Switch
            label={t('settings.flip')}
            hint={t('settings.flip.hint')}
            checked={s.flipDirection}
            onChange={(v) => settings.set({ flipDirection: v })}
            data-testid="set-flip"
          />
        </SettingsGroup>

        {sensitivityHidden ? null : (
          <SettingsGroup title={t('settings.sensitivity')} data-testid="set-group-sensitivity">
            {s.gesture === 'head' ? (
              <div class="set-block">
                <Slider
                  label={t('settings.angle')}
                  min={SETTING_LIMITS.yawThresholdDeg.min}
                  max={SETTING_LIMITS.yawThresholdDeg.max}
                  step={SETTING_LIMITS.yawThresholdDeg.step}
                  value={s.yawThresholdDeg}
                  format={(deg) => t('controls.angle.value', { deg })}
                  onInput={(v) => settings.set({ yawThresholdDeg: v })}
                  data-testid="set-angle"
                />
                <p class="set-hint">{t('settings.angle.hint')}</p>
              </div>
            ) : (
              <div class="set-block">
                <Slider
                  label={t('settings.mouth')}
                  min={SETTING_LIMITS.mouthThreshold.min}
                  max={SETTING_LIMITS.mouthThreshold.max}
                  step={SETTING_LIMITS.mouthThreshold.step}
                  value={s.mouthThreshold}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onInput={(v) => settings.set({ mouthThreshold: v })}
                  data-testid="set-mouth"
                />
              </div>
            )}
            <div class="set-block">
              <Slider
                label={t('settings.hold')}
                min={SETTING_LIMITS.holdMs.min}
                max={SETTING_LIMITS.holdMs.max}
                step={SETTING_LIMITS.holdMs.step}
                value={s.holdMs}
                format={secText}
                onInput={(v) => settings.set({ holdMs: v })}
                data-testid="set-hold"
              />
            </div>
            <div class="set-block">
              <Slider
                label={t('settings.cooldown')}
                min={SETTING_LIMITS.cooldownMs.min}
                max={SETTING_LIMITS.cooldownMs.max}
                step={SETTING_LIMITS.cooldownMs.step}
                value={s.cooldownMs}
                format={secText}
                onInput={(v) => settings.set({ cooldownMs: v })}
                data-testid="set-cooldown"
              />
            </div>
          </SettingsGroup>
        )}

        <SettingsGroup title={t('settings.turning')} data-testid="set-group-turning">
          <Switch
            label={t('settings.half')}
            hint={t('settings.half.hint')}
            checked={s.halfPage}
            onChange={(v) => settings.set({ halfPage: v })}
            data-testid="set-half"
          />
        </SettingsGroup>

        <SettingsGroup title={t('settings.pedal')} data-testid="set-group-pedal">
          <div class="set-block">
            <p class="set-hint">{t('settings.pedal.hint')}</p>
            <p class="set-hint">{t('settings.pedal.keyboardHint')}</p>
          </div>
          <div class="set-block set-pedal">
            <PedalRow
              dir="next"
              keys={s.keysNext}
              learning={learning === 'next'}
              onRemove={(k) => removeKey('next', k)}
              onLearn={() => setLearning(learning === 'next' ? null : 'next')}
            />
            <PedalRow
              dir="prev"
              keys={s.keysPrev}
              learning={learning === 'prev'}
              onRemove={(k) => removeKey('prev', k)}
              onLearn={() => setLearning(learning === 'prev' ? null : 'prev')}
            />
            <Button variant="ghost" onClick={() => { setLearning(null); settings.set({ keysNext: [...DEFAULT_SETTINGS.keysNext], keysPrev: [...DEFAULT_SETTINGS.keysPrev] }); }} data-testid="set-keys-reset">
              {t('settings.pedal.reset')}
            </Button>
          </div>
        </SettingsGroup>

        <SettingsGroup title={t('settings.look')} data-testid="set-group-look">
          <div class="set-block">
            <Segmented
              label={t('settings.theme')}
              data-testid="set-theme"
              value={s.appTheme}
              options={THEMES.map((th) => ({ value: th, label: t(`settings.theme.${th}`) }))}
              onChange={(v) => settings.set({ appTheme: v as AppTheme })}
            />
          </div>
          <div class="set-block">
            <p class="set-label">{t('settings.paper')}</p>
            <div class="set-chips">
              {PAPER_THEMES.map((p: PaperTheme) => (
                <Chip key={p} selected={s.paper === p} onClick={() => settings.set({ paper: p })} data-testid={`set-paper-${p}`}>
                  {t(`paper.${p}`)}
                </Chip>
              ))}
            </div>
          </div>
          <Switch
            label={t('settings.crop')}
            checked={s.autoCrop}
            onChange={(v) => settings.set({ autoCrop: v })}
            data-testid="set-crop"
          />
        </SettingsGroup>

        <SettingsGroup title={t('settings.notes')} data-testid="set-group-notes">
          <Switch
            label={t('settings.fingerDraw')}
            hint={t('settings.fingerDraw.hint')}
            checked={s.fingerDraw}
            onChange={(v) => settings.set({ fingerDraw: v })}
            data-testid="set-finger"
          />
        </SettingsGroup>

        <SettingsGroup title={t('settings.camera')} data-testid="set-group-camera">
          <Switch
            label={t('settings.useGpu')}
            hint={t('settings.useGpu.hint')}
            checked={s.useGpu}
            onChange={(v) => settings.set({ useGpu: v })}
            data-testid="set-gpu"
          />
        </SettingsGroup>

        <SettingsGroup title={t('settings.storage')} data-testid="set-group-storage">
          <div class="set-block">
            {estimate?.volatile ? (
              <p class="set-warning" role="alert" data-testid="set-storage-volatile">
                {t('settings.storage.volatile')}
              </p>
            ) : (
              <>
                <p class="set-value">{storageUsedText(estimate)}</p>
                <p class="set-hint">
                  {estimate?.persisted ? t('settings.storage.persisted') : t('settings.storage.notPersisted')}
                </p>
              </>
            )}
          </div>
        </SettingsGroup>

        <SettingsGroup title={t('settings.about')} data-testid="set-group-about">
          <div class="set-block set-about">
            <p class="set-hint">{t('settings.privacy')}</p>
            <p class="set-hint">{t('settings.privacy.search')}</p>
            <p class="set-hint">{t('settings.sources')}</p>
            <p class="set-hint">{t('settings.sources.legal')}</p>
            <p class="set-hint">{t('settings.licenses')}</p>
            <p class="set-value">{t('settings.version', { version: __APP_VERSION__ })}</p>
            <Button
              variant="ghost"
              full
              onClick={() => {
                settings.set({ onboardingDone: false });
                navigate('/onboarding');
              }}
              data-testid="set-onboarding"
            >
              {t('settings.onboardingAgain')}
            </Button>
            <Button variant="danger" full onClick={() => setConfirmReset(true)} data-testid="set-reset">
              {t('settings.reset')}
            </Button>
          </div>
        </SettingsGroup>

        <ConfirmSheet
          open={confirmReset}
          title={t('settings.reset')}
          confirmLabel={t('settings.reset')}
          danger
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            setConfirmReset(false);
            settings.reset();
            settings.set({ onboardingDone: true });
          }}
          data-testid="set-reset-confirm"
        />
      </div>
    </main>
  );
}

function storageUsedText(e: StorageEstimate | null): string {
  if (!e || e.usageBytes === null || e.quotaBytes === null) return t('settings.storage.unknown');
  return t('settings.storage.used', { used: sizeText(e.usageBytes), quota: sizeText(e.quotaBytes) });
}
