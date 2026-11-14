import { beforeEach, describe, expect, it, vi } from 'vitest';

// The plugin runtime is replaced: the test only needs the options that initPwa passes.
let captured: { onNeedReload?: () => void } = {};
vi.mock('virtual:pwa-register', () => ({
  registerSW: (opts: { onNeedReload?: () => void }) => {
    captured = opts;
    return async () => undefined;
  },
}));

import { initPwa } from './register';
import { pageActions, setUnsavedNotesGuard } from './guard';

describe('pwa: reload after another tab updated the worker (F2)', () => {
  const reload = vi.fn();
  let playRoute = false;

  beforeEach(() => {
    reload.mockReset();
    pageActions.reload = reload;
  });

  it('passes onNeedReload to the plugin, so it does not reload on its own', () => {
    initPwa({ isPlayRoute: () => playRoute });
    expect(typeof captured.onNeedReload).toBe('function');
  });

  it('reloads at once when the user is not on the play route', () => {
    playRoute = false;
    captured.onNeedReload?.();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('on the play route waits, then reloads when the user leaves play', () => {
    playRoute = true;
    captured.onNeedReload?.();
    expect(reload).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('hashchange'));
    expect(reload).not.toHaveBeenCalled();
    playRoute = false;
    window.dispatchEvent(new Event('hashchange'));
    expect(reload).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('hashchange'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('never reloads while a note session has unsaved changes', () => {
    let dirty = true;
    const remove = setUnsavedNotesGuard(() => dirty);
    playRoute = false;
    captured.onNeedReload?.();
    expect(reload).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('hashchange'));
    expect(reload).not.toHaveBeenCalled();
    dirty = false;
    window.dispatchEvent(new Event('hashchange'));
    expect(reload).toHaveBeenCalledTimes(1);
    remove();
  });

  it('reloads when the note screen closes and drops its guard', () => {
    const remove = setUnsavedNotesGuard(() => true);
    playRoute = false;
    captured.onNeedReload?.();
    expect(reload).not.toHaveBeenCalled();
    remove();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
