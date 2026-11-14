import { useEffect, useState } from 'preact/hooks';
import {
  DEFAULT_SETTINGS,
  SETTING_LIMITS,
  type AppTheme,
  type GestureKind,
  type LibrarySort,
  type PaperTheme,
  type Settings,
  type SettingsStore,
} from '../contracts';

export const SETTINGS_KEY = 'noty.settings.v1';

const GESTURES: GestureKind[] = ['head', 'mouth', 'off'];
const PAPERS: PaperTheme[] = ['ivory', 'sepia', 'night', 'contrast', 'plain'];
const THEMES: AppTheme[] = ['auto', 'light', 'dark'];
const SORTS: LibrarySort[] = ['recent', 'title', 'added'];

function clampNum(raw: unknown, fallback: number, lim: { min: number; max: number }): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.min(lim.max, Math.max(lim.min, raw));
}
function pick<T extends string>(raw: unknown, list: readonly T[], fallback: T): T {
  return typeof raw === 'string' && (list as readonly string[]).includes(raw) ? (raw as T) : fallback;
}
function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback;
}
function keys(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return [...fallback];
  // A stored array is kept as it is, even when empty: the user may have no key for one direction.
  const list = raw.filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length <= 32).slice(0, 16);
  return [...new Set(list)];
}

/** Unknown or invalid fields fall back to defaults. Numbers are clamped to SETTING_LIMITS. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const keysNext = keys(r.keysNext, d.keysNext);
  const keysPrev = keys(r.keysPrev, d.keysPrev);
  return {
    version: 1,
    gesture: pick(r.gesture, GESTURES, d.gesture),
    yawThresholdDeg: clampNum(r.yawThresholdDeg, d.yawThresholdDeg, SETTING_LIMITS.yawThresholdDeg),
    holdMs: clampNum(r.holdMs, d.holdMs, SETTING_LIMITS.holdMs),
    cooldownMs: clampNum(r.cooldownMs, d.cooldownMs, SETTING_LIMITS.cooldownMs),
    mouthThreshold: clampNum(r.mouthThreshold, d.mouthThreshold, SETTING_LIMITS.mouthThreshold),
    flipDirection: bool(r.flipDirection, d.flipDirection),
    halfPage: bool(r.halfPage, d.halfPage),
    paper: pick(r.paper, PAPERS, d.paper),
    autoCrop: bool(r.autoCrop, d.autoCrop),
    appTheme: pick(r.appTheme, THEMES, d.appTheme),
    fingerDraw: bool(r.fingerDraw, d.fingerDraw),
    keysNext,
    // One key never turns both ways: a key in the next list is removed from the previous list.
    keysPrev: keysPrev.filter((k) => !keysNext.includes(k)),
    useGpu: bool(r.useGpu, d.useGpu),
    onboardingDone: bool(r.onboardingDone, d.onboardingDone),
    librarySort: pick(r.librarySort, SORTS, d.librarySort),
  };
}

function load(): Settings {
  try {
    const text = localStorage.getItem(SETTINGS_KEY);
    return sanitizeSettings(text ? JSON.parse(text) : null);
  } catch {
    return sanitizeSettings(null);
  }
}

function save(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage may be blocked; settings then live in memory only */
  }
}

/** Sets <html data-theme> to light or dark. 'auto' follows prefers-color-scheme. */
export function applyTheme(theme: AppTheme): void {
  if (typeof document === 'undefined') return;
  let dark = theme === 'dark';
  if (theme === 'auto') {
    try {
      dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      dark = false;
    }
  }
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

export function createSettingsStore(): SettingsStore {
  let current = load();
  const subs = new Set<(s: Settings) => void>();
  applyTheme(current.appTheme);
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
      if (current.appTheme === 'auto') applyTheme('auto');
    });
  } catch {
    /* no matchMedia */
  }
  const emit = () => subs.forEach((cb) => cb(current));
  return {
    get: () => current,
    set(patch) {
      const merged: Record<string, unknown> = { ...current, ...patch };
      // When only the previous list changes, its keys win over the next list (a learned key moves).
      if (patch.keysPrev && !patch.keysNext) {
        merged.keysNext = current.keysNext.filter((k) => !patch.keysPrev!.includes(k));
      }
      current = sanitizeSettings(merged);
      save(current);
      applyTheme(current.appTheme);
      emit();
    },
    reset() {
      current = sanitizeSettings(null);
      save(current);
      applyTheme(current.appTheme);
      emit();
    },
    subscribe(cb) {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
  };
}

export const settings: SettingsStore = createSettingsStore();

/** Preact hook: the current settings, re-rendering on change. */
export function useSettings(): Settings {
  const [value, setValue] = useState<Settings>(settings.get());
  useEffect(() => {
    setValue(settings.get());
    return settings.subscribe(setValue);
  }, []);
  return value;
}
