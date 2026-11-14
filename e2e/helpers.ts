import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PoseSample, Settings } from '../src/contracts';

const ROOT = resolve(import.meta.dirname, '..');

export function fixturePath(name: string): string {
  return resolve(ROOT, 'tests/fixtures', name);
}

export interface OpenOpts {
  onboarded?: boolean;
  settings?: Partial<Settings>;
  path?: string;
  query?: string;
}

/** Opens the app in test mode. Settings are set with an init script before the app boots. */
export async function openApp(page: Page, opts: OpenOpts = {}): Promise<void> {
  const settings = { onboardingDone: opts.onboarded ?? true, ...(opts.settings ?? {}) };
  await page.addInitScript((value) => {
    try {
      if (!sessionStorage.getItem('noty.e2e.seeded')) {
        localStorage.setItem('noty.settings.v1', JSON.stringify(value));
        sessionStorage.setItem('noty.e2e.seeded', '1');
      }
    } catch {
      /* ignore */
    }
  }, settings);
  const query = opts.query ? `&${opts.query.replace(/^[?&]/, '')}` : '';
  await page.goto(`./?test=1${query}#${opts.path ?? '/'}`);
  await page.waitForFunction(() => !!window.__notyTest);
}

/** Adds a fixture PDF to storage and returns its score id. */
export async function addFixtureScore(page: Page, fileName: string, title: string, pageCount: number, composer?: string): Promise<string> {
  const b64 = readFileSync(fixturePath(fileName)).toString('base64');
  return page.evaluate(([data, t, n, c]) => window.__notyTest!.addScore(data as string, { title: t as string, pageCount: n as number, composer: c as string | undefined }), [b64, title, pageCount, composer]);
}

/** Waits until the gesture probe says running, then replays a trace from tests/traces. */
export async function replayTrace(page: Page, traceName: string): Promise<void> {
  const trace = JSON.parse(readFileSync(resolve(ROOT, 'tests/traces', `${traceName}.json`), 'utf8')) as { samples: PoseSample[] };
  await page.waitForFunction(
    () => {
      const g = window.__notyTest?.getState().gesture as { status?: string } | undefined;
      return g?.status === 'running';
    },
    undefined,
    { timeout: 10_000 },
  );
  await page.evaluate((samples) => window.__notyTest!.replay(samples), trace.samples);
}

export async function getState(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => window.__notyTest!.getState());
}

export interface ErrorWatch {
  errors: string[];
  expectNoErrors(): void;
}

/** MediaPipe prints its info log through console.error. Pass this as `ignore` in tests that run the real camera. */
export const MEDIAPIPE_LOG_IGNORE: RegExp[] = [/^console: (INFO|WARNING): /, /^console: [WI]\d{4} /, /XNNPACK/, /gl_context/i, /Graph successfully started/i];

/** Collects console errors, page errors and CSP violations. A CSP violation is never ignored. */
export function watchErrors(page: Page, opts: { ignore?: RegExp[] } = {}): ErrorWatch {
  const errors: string[] = [];
  const record = (entry: string) => {
    if (!entry.includes('CSP violation') && (opts.ignore ?? []).some((re) => re.test(entry))) return;
    errors.push(entry);
  };
  page.on('console', (m) => {
    if (m.type() === 'error') record(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => record(`pageerror: ${e.message}`));
  void page.addInitScript(() => {
    window.addEventListener('securitypolicyviolation', (e) => {
      console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  return {
    errors,
    expectNoErrors() {
      expect(errors, errors.join('\n')).toEqual([]);
    },
  };
}
