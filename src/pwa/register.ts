import { registerSW } from 'virtual:pwa-register';
import { toast } from '../ui';
import { t } from '../i18n';

/** Looks for a new version at most once an hour when a Home Screen app comes back. */
const UPDATE_CHECK_MS = 60 * 60 * 1000;
const UPDATE_TOAST_MS = 60_000;

type ApplyUpdate = (reloadPage?: boolean) => Promise<void>;

let initialized = false;
let isPlayRoute: () => boolean = () => false;
let applyNow: ApplyUpdate | null = null;
let registration: ServiceWorkerRegistration | null = null;
let lastCheck = 0;
/** True once a new version is waiting. It stays true until the user taps «Оновити» outside play mode. */
let updateWaiting = false;
let closeUpdateToast: (() => void) | null = null;

function hideUpdateToast(): void {
  try {
    const close = closeUpdateToast;
    closeUpdateToast = null;
    close?.();
  } catch {
    /* ignore */
  }
}

/** Shows the update toast, except in play mode. */
function showUpdateToast(): void {
  try {
    if (isPlayRoute()) return;
    hideUpdateToast();
    closeUpdateToast = toast(t('pwa.updateReady'), {
      kind: 'ok',
      durationMs: UPDATE_TOAST_MS,
      action: { label: t('pwa.update'), onClick: applyUpdate },
    });
  } catch {
    /* ignore */
  }
}

/** Runs only on a tap. The play-route check runs again at the moment of the tap. */
function applyUpdate(): void {
  try {
    if (isPlayRoute()) return;
    if (!applyNow) return;
    hideUpdateToast();
    void applyNow(true).catch(() => {});
  } catch {
    /* ignore */
  }
}

function onHashChange(): void {
  try {
    if (!updateWaiting) return;
    if (isPlayRoute()) hideUpdateToast();
    else showUpdateToast();
  } catch {
    /* ignore */
  }
}

function onVisibilityChange(): void {
  try {
    if (document.visibilityState !== 'visible') return;
    if (!registration || !navigator.onLine) return;
    const now = Date.now();
    if (now - lastCheck < UPDATE_CHECK_MS) return;
    lastCheck = now;
    void registration.update().catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Registers the service worker with the prompt flow. Never breaks the app. */
export function initPwa(opts: { isPlayRoute(): boolean }): void {
  try {
    if (initialized) return;
    initialized = true;
    isPlayRoute = opts.isPlayRoute;
    window.addEventListener('hashchange', onHashChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    applyNow = registerSW({
      immediate: true,
      onNeedRefresh() {
        updateWaiting = true;
        showUpdateToast();
      },
      onOfflineReady() {
        toast(t('pwa.offlineReady'), { kind: 'ok' });
      },
      onRegisteredSW(_swUrl: string, reg: ServiceWorkerRegistration | undefined) {
        registration = reg ?? null;
        lastCheck = Date.now();
      },
    });
  } catch {
    /* the app works without the service worker */
  }
}
