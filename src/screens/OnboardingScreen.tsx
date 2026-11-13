import type { ScreenProps } from '../contracts';
import { TopBar } from '../ui';
import { t } from '../i18n';
import './Onboarding.css';

/** STUB: replaced by its screen package. */
export default function OnboardingScreen(_props: ScreenProps) {
  return (
    <main class="screen" data-testid="screen-onboarding">
      <div class="screen-inner">
        <TopBar title={t('onb.1.title')} serif />
      </div>
    </main>
  );
}
