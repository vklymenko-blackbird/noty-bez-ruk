import type { ScreenProps } from '../contracts';
import { TopBar } from '../ui';
import { t } from '../i18n';
import './Settings.css';

/** STUB: replaced by its screen package. */
export default function SettingsScreen(_props: ScreenProps) {
  return (
    <main class="screen" data-testid="screen-settings">
      <div class="screen-inner">
        <TopBar title={t('settings.title')} serif />
      </div>
    </main>
  );
}
