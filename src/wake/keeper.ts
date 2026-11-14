import type { WakeKeeper } from '../contracts';

type Method = 'wakelock' | 'video' | 'none';

/** Minimal shape of a Screen Wake Lock sentinel (kept small so tests can mock it). */
interface Sentinel {
  release(): Promise<void> | void;
  addEventListener(type: 'release', cb: () => void): void;
  removeEventListener(type: 'release', cb: () => void): void;
}

interface WakeLockApi {
  request(type: 'screen'): Promise<Sentinel>;
}

function wakeLockApi(): WakeLockApi | null {
  const nav = globalThis.navigator as (Navigator & { wakeLock?: WakeLockApi }) | undefined;
  return nav?.wakeLock ?? null;
}

function pageVisibleOrUnknown(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

/**
 * Keeps the screen on while play mode runs.
 *
 * Order: Screen Wake Lock first. If it is missing or fails, a tiny looping muted
 * video is played instead ('video').
 *
 * WARNING: 'video' is only a weak try. It is NOT proven to keep an iPad awake.
 * That is why the play screen shows the Auto-Lock hint for every result except 'wakelock'.
 *
 * While acquired, the lock is requested again when the page becomes visible and
 * when the system releases the lock while the page is visible (iPadOS can drop it).
 */
export function createWakeKeeper(): WakeKeeper {
  let acquired = false;
  let generation = 0;
  let method: Method | null = null;
  let pending: Promise<Method> | null = null;
  let sentinel: Sentinel | null = null;
  let video: HTMLVideoElement | null = null;
  let listening = false;

  /** Lets go of a sentinel and stops listening to it. Errors from release() are ignored. */
  function dropSentinel(s: Sentinel): void {
    s.removeEventListener('release', onSentinelRelease);
    try {
      Promise.resolve(s.release()).catch(() => undefined);
    } catch {
      /* ignore */
    }
  }

  function onSentinelRelease(): void {
    sentinel = null;
    if (acquired && pageVisibleOrUnknown()) void requestLock();
  }

  /** Requests a screen wake lock. Returns true when the lock is held. */
  async function requestLock(): Promise<boolean> {
    const api = wakeLockApi();
    if (!api) return false;
    const gen = generation;
    try {
      const s = await api.request('screen');
      if (!acquired || gen !== generation) {
        dropSentinel(s);
        return false;
      }
      if (sentinel) dropSentinel(sentinel);
      sentinel = s;
      s.addEventListener('release', onSentinelRelease);
      return true;
    } catch {
      return false;
    }
  }

  /** Plays the 1 px muted loop video. Returns true when play() resolves. */
  async function startVideo(): Promise<boolean> {
    try {
      const v = document.createElement('video');
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.src = import.meta.env.BASE_URL + 'media/awake.mp4';
      v.style.width = '1px';
      v.style.height = '1px';
      v.style.opacity = '0';
      v.style.position = 'fixed';
      v.style.pointerEvents = 'none';
      document.body.appendChild(v);
      video = v;
      await v.play();
      return true;
    } catch {
      stopVideo();
      return false;
    }
  }

  function stopVideo(): void {
    const v = video;
    video = null;
    if (!v) return;
    try {
      v.pause();
    } catch {
      /* ignore */
    }
    v.remove();
  }

  const onVisibility = () => {
    if (!acquired || document.visibilityState !== 'visible') return;
    if (!sentinel) void requestLock();
    if (video && video.paused) void video.play().catch(() => undefined);
  };

  function attach(): void {
    if (listening) return;
    listening = true;
    document.addEventListener('visibilitychange', onVisibility);
  }

  function detach(): void {
    if (!listening) return;
    listening = false;
    document.removeEventListener('visibilitychange', onVisibility);
  }

  async function run(gen: number): Promise<Method> {
    if (await requestLock()) return 'wakelock';
    if (gen !== generation) return 'none';
    if (await startVideo()) {
      if (gen !== generation) {
        stopVideo();
        return 'none';
      }
      return 'video';
    }
    return 'none';
  }

  return {
    acquire(): Promise<'wakelock' | 'video' | 'none'> {
      if (method === 'wakelock' || method === 'video') return Promise.resolve(method);
      if (pending) return pending;
      acquired = true;
      attach();
      const gen = generation;
      const job: Promise<Method> = run(gen).then((m) => {
        if (pending === job) pending = null;
        if (gen === generation) method = m;
        return m;
      });
      pending = job;
      return job;
    },

    release(): void {
      acquired = false;
      generation += 1;
      detach();
      method = null;
      pending = null;
      const s = sentinel;
      sentinel = null;
      if (s) dropSentinel(s);
      stopVideo();
    },
  };
}
