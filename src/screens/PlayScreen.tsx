import type { ScreenProps } from '../contracts';
import { TopBar } from '../ui';
import { t } from '../i18n';
import './Play.css';

/** STUB: replaced by its screen package. */
export default function PlayScreen(_props: ScreenProps) {
  return (
    <main class="screen" data-testid="screen-play">
      <div class="screen-inner">
        <TopBar title={t('app.name')} serif />
      </div>
    </main>
  );
}
