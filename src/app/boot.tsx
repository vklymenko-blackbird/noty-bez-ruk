import { EmptyState } from '../ui';
import { t } from '../i18n';

/** True when the browser has everything the app needs: WebAssembly, IndexedDB and dvh units. */
export function isBrowserSupported(): boolean {
  try {
    if (typeof WebAssembly !== 'object') return false;
    if (!('indexedDB' in window)) return false;
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function' || !CSS.supports('height', '100dvh')) return false;
    return true;
  } catch {
    return false;
  }
}

/** Full-screen message shown instead of the app on an old browser. */
export function BootUnsupported() {
  return (
    <main class="screen">
      <div class="screen-inner">
        <EmptyState data-testid="boot-unsupported" title={t('boot.unsupported.title')} body={t('boot.unsupported.body')} art="stave" />
      </div>
    </main>
  );
}
