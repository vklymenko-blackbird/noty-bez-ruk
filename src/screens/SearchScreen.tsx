import type { ScreenProps } from '../contracts';
import { TopBar } from '../ui';
import { t } from '../i18n';
import './Search.css';

/** STUB: replaced by its screen package. */
export default function SearchScreen(_props: ScreenProps) {
  return (
    <main class="screen" data-testid="screen-search">
      <div class="screen-inner">
        <TopBar title={t('search.title')} serif />
      </div>
    </main>
  );
}
