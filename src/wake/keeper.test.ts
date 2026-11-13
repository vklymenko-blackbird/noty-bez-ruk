import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWakeKeeper } from './keeper';

interface MockSentinel extends EventTarget {
  release: ReturnType<typeof vi.fn>;
}

function makeSentinel(): MockSentinel {
  const t = new EventTarget() as MockSentinel;
  t.release = vi.fn(async () => undefined);
  return t;
}

/** Installs navigator.wakeLock with the given request implementation. */
function setWakeLock(request: ReturnType<typeof vi.fn> | undefined): void {
  if (request === undefined) {
    Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true });
    return;
  }
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
}

const proto = HTMLMediaElement.prototype as HTMLMediaElement & { play: () => Promise<void> };
const originalPlay = proto.play;
let play: ReturnType<typeof vi.fn>;

beforeEach(() => {
  play = vi.fn(async () => undefined);
  proto.play = play as unknown as () => Promise<void>;
});

afterEach(() => {
  proto.play = originalPlay;
  setWakeLock(undefined);
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.querySelectorAll('video').forEach((v) => v.remove());
  vi.restoreAllMocks();
});

describe('createWakeKeeper: Screen Wake Lock', () => {
  it('resolves wakelock when the request succeeds', async () => {
    const s = makeSentinel();
    setWakeLock(vi.fn(async () => s));
    const keeper = createWakeKeeper();
    expect(await keeper.acquire()).toBe('wakelock');
    expect(play).not.toHaveBeenCalled();
    expect(document.querySelectorAll('video').length).toBe(0);
  });

  it('requests the screen lock with type screen', async () => {
    const request = vi.fn(async () => makeSentinel());
    setWakeLock(request);
    await createWakeKeeper().acquire();
    expect(request).toHaveBeenCalledWith('screen');
  });

  it('release() releases the sentinel', async () => {
    const s = makeSentinel();
    setWakeLock(vi.fn(async () => s));
    const keeper = createWakeKeeper();
    await keeper.acquire();
    keeper.release();
    expect(s.release).toHaveBeenCalledTimes(1);
  });

  it('when the sentinel fires release while acquired, requests again', async () => {
    const first = makeSentinel();
    const second = makeSentinel();
    const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    setWakeLock(request);
    const keeper = createWakeKeeper();
    await keeper.acquire();
    first.dispatchEvent(new Event('release'));
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    keeper.release();
  });

  it('after release() a sentinel release event does not request again', async () => {
    const s = makeSentinel();
    const request = vi.fn(async () => s);
    setWakeLock(request);
    const keeper = createWakeKeeper();
    await keeper.acquire();
    keeper.release();
    s.dispatchEvent(new Event('release'));
    await new Promise((r) => setTimeout(r, 0));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('requests again when the page becomes visible and no lock is held', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('denied'))
      .mockResolvedValueOnce(makeSentinel());
    setWakeLock(request);
    const keeper = createWakeKeeper();
    expect(await keeper.acquire()).toBe('video');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    keeper.release();
  });
});

describe('createWakeKeeper: video fallback', () => {
  it('resolves video when the request rejects and play resolves', async () => {
    setWakeLock(vi.fn(async () => Promise.reject(new Error('no'))));
    const keeper = createWakeKeeper();
    expect(await keeper.acquire()).toBe('video');
    keeper.release();
  });

  it('resolves video when there is no navigator.wakeLock', async () => {
    setWakeLock(undefined);
    const keeper = createWakeKeeper();
    expect(await keeper.acquire()).toBe('video');
    keeper.release();
  });

  it('adds a muted, looping, inline video that points at media/awake.mp4', async () => {
    setWakeLock(undefined);
    const keeper = createWakeKeeper();
    await keeper.acquire();
    const v = document.querySelector('video');
    expect(v).not.toBeNull();
    expect(v?.muted).toBe(true);
    expect(v?.loop).toBe(true);
    expect(v?.src.endsWith('media/awake.mp4')).toBe(true);
    expect(play).toHaveBeenCalled();
    keeper.release();
  });

  it('release() pauses and removes the video', async () => {
    setWakeLock(undefined);
    const keeper = createWakeKeeper();
    await keeper.acquire();
    keeper.release();
    expect(document.querySelectorAll('video').length).toBe(0);
  });

  it('resolves none when the request rejects and play rejects', async () => {
    setWakeLock(vi.fn(async () => Promise.reject(new Error('no'))));
    play.mockImplementation(async () => {
      throw new Error('autoplay');
    });
    const keeper = createWakeKeeper();
    expect(await keeper.acquire()).toBe('none');
    expect(document.querySelectorAll('video').length).toBe(0);
    keeper.release();
  });

  it('resolves none when there is no wake lock and play rejects', async () => {
    setWakeLock(undefined);
    play.mockImplementation(async () => {
      throw new Error('autoplay');
    });
    const keeper = createWakeKeeper();
    expect(await keeper.acquire()).toBe('none');
    keeper.release();
  });
});

describe('createWakeKeeper: lifecycle', () => {
  it('acquire twice requests the lock once', async () => {
    const request = vi.fn(async () => makeSentinel());
    setWakeLock(request);
    const keeper = createWakeKeeper();
    const a = await keeper.acquire();
    const b = await keeper.acquire();
    expect(a).toBe('wakelock');
    expect(b).toBe('wakelock');
    expect(request).toHaveBeenCalledTimes(1);
    keeper.release();
  });

  it('two overlapping acquire calls share one request', async () => {
    const request = vi.fn(async () => makeSentinel());
    setWakeLock(request);
    const keeper = createWakeKeeper();
    const [a, b] = await Promise.all([keeper.acquire(), keeper.acquire()]);
    expect(a).toBe('wakelock');
    expect(b).toBe('wakelock');
    expect(request).toHaveBeenCalledTimes(1);
    keeper.release();
  });

  it('release twice is safe', async () => {
    setWakeLock(vi.fn(async () => makeSentinel()));
    const keeper = createWakeKeeper();
    await keeper.acquire();
    keeper.release();
    expect(() => keeper.release()).not.toThrow();
  });

  it('release before acquire is safe', () => {
    const keeper = createWakeKeeper();
    expect(() => keeper.release()).not.toThrow();
  });

  it('acquire works again after release', async () => {
    const request = vi.fn(async () => makeSentinel());
    setWakeLock(request);
    const keeper = createWakeKeeper();
    await keeper.acquire();
    keeper.release();
    expect(await keeper.acquire()).toBe('wakelock');
    expect(request).toHaveBeenCalledTimes(2);
    keeper.release();
  });

  it('a lock that arrives after release() is given back at once', async () => {
    const s = makeSentinel();
    let finish: (v: MockSentinel) => void = () => undefined;
    setWakeLock(vi.fn(() => new Promise<MockSentinel>((r) => (finish = r))));
    const keeper = createWakeKeeper();
    const pending = keeper.acquire();
    keeper.release();
    finish(s);
    expect(await pending).toBe('none');
    expect(s.release).toHaveBeenCalled();
  });
});
