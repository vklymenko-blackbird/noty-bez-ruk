import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../contracts';
import { createSettingsStore, sanitizeSettings, SETTINGS_KEY } from './store';

describe('sanitizeSettings', () => {
  it('returns defaults for junk', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('x')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings([])).toEqual(DEFAULT_SETTINGS);
  });
  it('clamps numbers to the limits', () => {
    const s = sanitizeSettings({ yawThresholdDeg: 99, holdMs: 1, cooldownMs: 'x', mouthThreshold: 0.1 });
    expect(s.yawThresholdDeg).toBe(35);
    expect(s.holdMs).toBe(300);
    expect(s.cooldownMs).toBe(DEFAULT_SETTINGS.cooldownMs);
    expect(s.mouthThreshold).toBe(0.3);
  });
  it('drops invalid enums and keys', () => {
    const s = sanitizeSettings({ gesture: 'nod', paper: 'night', keysNext: [1, 'a'], keysPrev: [] });
    expect(s.gesture).toBe('head');
    expect(s.paper).toBe('night');
    expect(s.keysNext).toEqual(['a']);
    expect(s.keysPrev).toEqual(DEFAULT_SETTINGS.keysPrev);
  });
});

describe('settings store', () => {
  it('persists and notifies', () => {
    const store = createSettingsStore();
    const cb = vi.fn();
    store.subscribe(cb);
    store.set({ gesture: 'mouth', yawThresholdDeg: 25 });
    expect(store.get().gesture).toBe('mouth');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}').yawThresholdDeg).toBe(25);
  });
  it('reads saved settings at creation', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ onboardingDone: true, halfPage: false }));
    const store = createSettingsStore();
    expect(store.get().onboardingDone).toBe(true);
    expect(store.get().halfPage).toBe(false);
  });
  it('survives broken JSON and resets', () => {
    localStorage.setItem(SETTINGS_KEY, '{oops');
    const store = createSettingsStore();
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
    store.set({ useGpu: true });
    store.reset();
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
  });
  it('sets data-theme', () => {
    const store = createSettingsStore();
    store.set({ appTheme: 'dark' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    store.set({ appTheme: 'light' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
