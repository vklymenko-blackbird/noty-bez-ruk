import { useRef, useState } from 'preact/hooks';
import type { ScreenProps } from '../contracts';
import { Button, Card, Icon } from '../ui';
import { t } from '../i18n';
import { settings } from '../settings';
import { navigate } from '../app/router';
import './Onboarding.css';

/** Step -1 is the install step. Steps 0 to 2 are the three cards. */
type Step = -1 | 0 | 1 | 2;
const LAST_CARD = 2;
const SWIPE_MIN_PX = 48;

/** True when the app runs from the Home Screen (or is otherwise installed). */
function isInstalled(): boolean {
  try {
    const nav = navigator as Navigator & { standalone?: boolean };
    if (nav.standalone === true) return true;
    return typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

function TabletArt() {
  return (
    <svg class="onb-art" viewBox="0 0 240 200" aria-hidden="true">
      <rect x="60" y="20" width="120" height="90" rx="8" />
      <line x1="80" y1="45" x2="160" y2="45" />
      <line x1="80" y1="53" x2="160" y2="53" />
      <line x1="80" y1="61" x2="160" y2="61" />
      <line x1="80" y1="69" x2="160" y2="69" />
      <line x1="80" y1="77" x2="160" y2="77" />
      <ellipse class="onb-accent" cx="100" cy="69" rx="5" ry="4" />
      <line x1="120" y1="110" x2="120" y2="170" />
      <line x1="95" y1="170" x2="145" y2="170" />
    </svg>
  );
}

function HeadArt() {
  return (
    <svg class="onb-art" viewBox="0 0 240 200" aria-hidden="true">
      <path d="M120 40 C150 40 166 62 166 90 C166 118 150 136 128 142 L128 160 L108 160 L108 142 C86 136 74 118 74 90 C74 62 90 40 120 40 Z" />
      <path d="M40 100 L20 100" />
      <path d="M30 90 L20 100 L30 110" />
      <path class="onb-accent" d="M200 100 L220 100" />
      <path class="onb-accent" d="M210 90 L220 100 L210 110" />
    </svg>
  );
}

function CameraArt() {
  return (
    <svg class="onb-art" viewBox="0 0 240 200" aria-hidden="true">
      <path d="M90 50 L100 34 L140 34 L150 50" />
      <rect x="50" y="50" width="140" height="95" rx="10" />
      <circle cx="120" cy="97" r="24" />
      <path class="onb-accent" d="M176 118 L190 124 L190 136 Q190 148 176 154 Q162 148 162 136 L162 124 Z" />
    </svg>
  );
}

const CARD_ART = [TabletArt, HeadArt, CameraArt];
const CARD_TEXT = [
  ['onb.1.title', 'onb.1.body'],
  ['onb.2.title', 'onb.2.body'],
  ['onb.3.title', 'onb.3.body'],
] as const;

export default function OnboardingScreen(_props: ScreenProps) {
  const installed = isInstalled();
  const [step, setStep] = useState<Step>(installed ? 0 : -1);
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);

  const finish = () => {
    try {
      settings.set({ onboardingDone: true });
    } catch {
      /* the app still continues */
    }
    navigate('/', { replace: true });
  };

  const goTo = (next: number) => {
    setStep(Math.max(0, Math.min(LAST_CARD, next)) as Step);
  };

  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    touchX.current = touch ? touch.clientX : null;
    touchY.current = touch ? touch.clientY : null;
  };

  const onTouchEnd = (e: TouchEvent) => {
    const start = touchX.current;
    const startY = touchY.current;
    touchX.current = null;
    touchY.current = null;
    const end = e.changedTouches[0];
    if (start === null || startY === null || !end || step < 0) return;
    const dx = end.clientX - start;
    const dy = end.clientY - startY;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return;
    if (dx < 0) goTo(step + 1);
    else goTo(step - 1);
  };

  if (step === -1) {
    return (
      <main class="screen onb" data-testid="screen-onboarding">
        <div class="screen-inner onb-inner" data-testid="onb-install-first">
          <div class="onb-share" aria-hidden="true">
            <Icon name="share" size={32} />
          </div>
          <h1 class="onb-title">{t('onb.install.title')}</h1>
          <p class="onb-body">{t('onb.install.first')}</p>
          <p class="onb-body">{t('onb.install.body')}</p>
          <Button variant="secondary" size="lg" full class="onb-cta" onClick={() => goTo(0)} data-testid="onb-continue-safari">
            {t('onb.install.continue')}
          </Button>
        </div>
      </main>
    );
  }

  const Art = CARD_ART[step];
  const isLast = step === LAST_CARD;

  return (
    <main class="screen onb" data-testid="screen-onboarding" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div class="screen-inner onb-inner">
        <div class="onb-card" key={step}>
          <Art />
          <h1 class="onb-title">{t(CARD_TEXT[step][0])}</h1>
          <p class="onb-body">{t(CARD_TEXT[step][1])}</p>
          {isLast ? <p class="onb-charge">{t('onb.charge')}</p> : null}
          {isLast && !installed ? (
            <Card class="onb-install-card" data-testid="onb-install">
              <div class="onb-install-row">
                <Icon name="share" size={24} />
                <div>
                  <p class="onb-install-title">{t('onb.install.title')}</p>
                  <p class="onb-install-body">{t('onb.install.body')}</p>
                </div>
              </div>
            </Card>
          ) : null}
        </div>

        <div class="onb-dots" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} class={i === step ? 'onb-dot onb-dot--on' : 'onb-dot'} />
          ))}
        </div>

        <div class="onb-actions">
          {isLast ? (
            <Button variant="primary" size="lg" full onClick={finish} data-testid="onb-start">
              {t('onb.start')}
            </Button>
          ) : (
            <>
              <Button variant="primary" size="lg" full onClick={() => goTo(step + 1)} data-testid="onb-next">
                {t('onb.next')}
              </Button>
              <Button variant="ghost" size="lg" full onClick={finish} data-testid="onb-skip">
                {t('onb.skip')}
              </Button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
