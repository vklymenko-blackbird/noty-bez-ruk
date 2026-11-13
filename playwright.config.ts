import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
import { basename } from 'node:path';

function lanePorts() {
  const m = /lane(\d+)$/.exec(basename(process.cwd()));
  const n = process.env.LANE && /^\d+$/.test(process.env.LANE) ? Number(process.env.LANE) : m ? Number(m[1]) : 0;
  const base = 3200 + n * 10;
  return { dev: base, preview: base + 1, e2e: base + 2 };
}

const { e2e: port } = lanePorts();
const baseURL = `http://localhost:${port}/noty-bez-ruk/`;
const fakeCamera = resolve(process.cwd(), 'tests/fixtures/fake-camera.mjpeg');

export default defineConfig({
  testDir: 'e2e',
  workers: 2,
  retries: 0,
  reporter: 'line',
  outputDir: 'test-results',
  webServer: {
    command: `npm run build && npx vite preview --strictPort --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180000,
  },
  use: {
    baseURL,
    viewport: { width: 744, height: 1133 },
    deviceScaleFactor: 2,
    hasTouch: true,
    locale: 'uk-UA',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 744, height: 1133 },
        deviceScaleFactor: 2,
        hasTouch: true,
        locale: 'uk-UA',
        permissions: ['camera'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            `--use-file-for-fake-video-capture=${fakeCamera}`,
          ],
        },
      },
    },
    {
      name: 'webkit',
      grep: /@webkit/,
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 744, height: 1133 },
        deviceScaleFactor: 2,
        hasTouch: true,
        locale: 'uk-UA',
      },
    },
  ],
});
