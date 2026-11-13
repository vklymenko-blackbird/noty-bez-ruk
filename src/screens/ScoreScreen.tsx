import type { ScreenProps } from '../contracts';
import { TopBar } from '../ui';
import { t } from '../i18n';
import './Score.css';

/** STUB: replaced by its screen package. */
export default function ScoreScreen(_props: ScreenProps) {
  return (
    <main class="screen" data-testid="screen-score">
      <div class="screen-inner">
        <TopBar title={t('score.play')} serif />
      </div>
    </main>
  );
}
