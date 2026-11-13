import type { ScreenProps } from '../contracts';
import { TopBar } from '../ui';
import { t } from '../i18n';
import './Library.css';

/** STUB: replaced by its screen package. */
export default function LibraryScreen(_props: ScreenProps) {
  return (
    <main class="screen" data-testid="screen-library">
      <div class="screen-inner">
        <TopBar title={t('library.title')} serif />
      </div>
    </main>
  );
}
