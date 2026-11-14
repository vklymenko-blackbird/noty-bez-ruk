import type { ControlsSheetProps, PaperTheme } from '../contracts';
import { SETTING_LIMITS } from '../contracts';
import { PAPER_THEMES } from '../paper';
import { Button, Chip, Icon, Sheet, Slider, Switch } from '../ui';
import { t } from '../i18n';
import './controls.css';

/** Colour dot for each paper chip. Uses the paper tokens from SPEC 1.4. */
const PAPER_SWATCH: Record<PaperTheme, string> = {
  ivory: 'var(--paper-ivory)',
  sepia: 'var(--paper-sepia)',
  night: 'var(--paper-night)',
  contrast: 'var(--paper-white)',
  plain: 'var(--paper-white)',
};

/** Controls sheet of play mode. A pure view: all state comes from props. */
export default function ControlsSheet(props: ControlsSheetProps) {
  const { gesture, cameraStatus } = props;
  const hasCamera = gesture !== 'off';
  const isHead = gesture === 'head';
  const cameraRunning = cameraStatus === 'running';
  const limits = SETTING_LIMITS.yawThresholdDeg;

  return (
    <Sheet open={props.open} onClose={props.onClose} title={props.title} data-testid="controls-sheet">
      <div class="controls">
        {props.pageCount > 1 ? (
          <Slider
            data-testid="ctl-page"
            label={t('controls.page')}
            min={1}
            max={props.pageCount}
            step={1}
            value={props.page}
            format={(v) => t('common.pageOf', { page: v, count: props.pageCount })}
            onInput={(v) => props.onGoToPage(v)}
          />
        ) : null}

        <Switch data-testid="ctl-half" label={t('controls.half')} checked={props.halfPage} onChange={props.onHalfPage} />

        <div class="controls__papers">
          {PAPER_THEMES.map((theme) => (
            <Chip
              key={theme}
              data-testid={`ctl-paper-${theme}`}
              selected={props.paper === theme}
              swatch={PAPER_SWATCH[theme]}
              onClick={() => props.onPaper(theme)}
            >
              {t(`paper.${theme}`)}
            </Chip>
          ))}
        </div>

        <Switch data-testid="ctl-crop" label={t('score.crop')} checked={props.crop} onChange={props.onCrop} />

        {hasCamera ? (
          <div class="controls__camera">
            <p class="controls__status" data-testid="ctl-camera-status">
              <Icon name={cameraRunning ? 'camera' : 'cameraOff'} size={24} />
              <span>{cameraRunning ? t('controls.camera.running') : t('controls.camera.off')}</span>
            </p>

            {isHead ? (
              <Slider
                data-testid="ctl-angle"
                label={t('controls.angle')}
                min={limits.min}
                max={limits.max}
                step={limits.step}
                value={props.yawThresholdDeg}
                format={(v) => t('controls.angle.value', { deg: v })}
                onInput={(v) => props.onYawThreshold(v)}
              />
            ) : null}

            {isHead ? (
              <Button
                data-testid="ctl-recalibrate"
                size="lg"
                full
                icon="refresh"
                disabled={!cameraRunning}
                onClick={() => {
                  props.onRecalibrate();
                  props.onClose();
                }}
              >
                {t('controls.recalibrate')}
              </Button>
            ) : null}

            <Switch
              data-testid="ctl-flip"
              label={t('settings.flip')}
              hint={t('settings.flip.hint')}
              checked={props.flip}
              onChange={props.onFlip}
            />
          </div>
        ) : null}

        <div class="controls__actions">
          <Button data-testid="ctl-annotate" size="lg" icon="pen" onClick={() => props.onAnnotate()}>
            {t('controls.annotate')}
          </Button>
          <Button data-testid="ctl-exit" size="lg" icon="close" onClick={() => props.onExit()}>
            {t('controls.exit')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
