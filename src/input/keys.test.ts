import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../contracts';
import type { NavAction, Settings } from '../contracts';
import { attachKeyNav, keyToAction } from './keys';

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over }) as Settings;

function key(k: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
}

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
  document.body.replaceChildren();
});

describe('keyToAction', () => {
  const s = settings();

  it('maps the default next keys', () => {
    for (const k of ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter']) {
      expect(keyToAction({ key: k, repeat: false }, s)).toBe('next');
    }
  });

  it('maps the default prev keys', () => {
    for (const k of ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace']) {
      expect(keyToAction({ key: k, repeat: false }, s)).toBe('prev');
    }
  });

  it('returns null for an unknown key', () => {
    expect(keyToAction({ key: 'a', repeat: false }, s)).toBeNull();
  });

  it('ignores key repeat', () => {
    expect(keyToAction({ key: 'ArrowRight', repeat: true }, s)).toBeNull();
    expect(keyToAction({ key: 'ArrowLeft', repeat: true }, s)).toBeNull();
  });

  it('uses custom keys from settings', () => {
    const custom = settings({ keysNext: ['F1'], keysPrev: ['F2'] });
    expect(keyToAction({ key: 'F1', repeat: false }, custom)).toBe('next');
    expect(keyToAction({ key: 'F2', repeat: false }, custom)).toBe('prev');
    expect(keyToAction({ key: 'ArrowRight', repeat: false }, custom)).toBeNull();
  });
});

describe('attachKeyNav', () => {
  function attach(over: Partial<Settings> = {}) {
    const calls: NavAction[] = [];
    const detach = attachKeyNav(window, () => settings(over), (a) => calls.push(a));
    cleanups.push(detach);
    return calls;
  }

  it('runs onAction for a default next key and calls preventDefault', () => {
    const calls = attach();
    const e = key('ArrowRight');
    const spy = vi.spyOn(e, 'preventDefault');
    window.dispatchEvent(e);
    expect(calls).toEqual(['next']);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('runs onAction for a default prev key', () => {
    const calls = attach();
    window.dispatchEvent(key('PageUp'));
    expect(calls).toEqual(['prev']);
  });

  it('does not call preventDefault for an unrelated key', () => {
    const calls = attach();
    const e = key('q');
    const spy = vi.spyOn(e, 'preventDefault');
    window.dispatchEvent(e);
    expect(calls).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores key repeat', () => {
    const calls = attach();
    window.dispatchEvent(key('ArrowRight', { repeat: true }));
    expect(calls).toEqual([]);
  });

  it('ignores events with Meta, Ctrl or Alt', () => {
    const calls = attach();
    window.dispatchEvent(key('ArrowRight', { metaKey: true }));
    window.dispatchEvent(key('ArrowRight', { ctrlKey: true }));
    window.dispatchEvent(key('ArrowLeft', { altKey: true }));
    expect(calls).toEqual([]);
  });

  it('ignores keys typed into input, textarea and select', () => {
    const calls = attach();
    for (const tag of ['input', 'textarea', 'select']) {
      const el = document.createElement(tag);
      document.body.appendChild(el);
      el.dispatchEvent(key('ArrowRight'));
    }
    expect(calls).toEqual([]);
  });

  it('ignores keys inside a contenteditable element', () => {
    const calls = attach();
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    Object.defineProperty(div, 'isContentEditable', { value: true });
    document.body.appendChild(div);
    div.dispatchEvent(key('ArrowRight'));
    expect(calls).toEqual([]);
  });

  it('uses the settings returned by getSettings at each key press', () => {
    let current = settings({ keysNext: ['x'] });
    const calls: NavAction[] = [];
    cleanups.push(attachKeyNav(window, () => current, (a) => calls.push(a)));
    window.dispatchEvent(key('x'));
    current = settings({ keysNext: ['y'] });
    window.dispatchEvent(key('x'));
    window.dispatchEvent(key('y'));
    expect(calls).toEqual(['next', 'next']);
  });

  it('the returned function removes the listener', () => {
    const calls: NavAction[] = [];
    const detach = attachKeyNav(window, () => settings(), (a) => calls.push(a));
    detach();
    window.dispatchEvent(key('ArrowRight'));
    expect(calls).toEqual([]);
  });
});
