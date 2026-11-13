import { test, expect } from '@playwright/test';
import { MEDIAPIPE_LOG_IGNORE, openApp, watchErrors } from './helpers';

// Chromium only: this spec has no @webkit tag, so the webkit project skips it.
// The fake camera (tests/fixtures/fake-camera.mjpeg) shows no face.
test.describe('camera pose source (fake camera)', () => {
  test.setTimeout(60000);

  test('starts, reports samples without a face, and stops all tracks', async ({ page }) => {
    const watch = watchErrors(page, { ignore: MEDIAPIPE_LOG_IGNORE });
    await openApp(page, { query: 'camera=1' });

    const result = await page.evaluate(async () => {
      const pose = window.__notyTest!.modules.pose;
      const source = pose.createMediaPipePoseSource({ useGpu: false });
      const statuses: string[] = [];
      const samples: { facePresent: boolean }[] = [];
      source.onStatus((s) => statuses.push(s));
      source.subscribe((s) => samples.push(s));

      await source.start();
      const deadline = Date.now() + 45000;
      while (!statuses.includes('running') && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 100));
      }
      const hadStream = source.getVideoStream() !== null;
      const ranStatus = source.getStatus();
      const countAtRunning = samples.length;
      await new Promise((r) => setTimeout(r, 3000));
      const stream = source.getVideoStream();
      const tracks = stream ? stream.getTracks() : [];
      source.stop();
      return {
        statuses,
        ranStatus,
        hadStream,
        sampleCount: samples.length - countAtRunning,
        noFace: samples.every((s) => !s.facePresent),
        streamWasNotNull: stream !== null,
        trackStates: tracks.map((t) => t.readyState),
        statusAfterStop: source.getStatus(),
        streamAfterStop: source.getVideoStream(),
      };
    });

    expect(result.statuses).toContain('running');
    expect(result.ranStatus).toBe('running');
    expect(result.hadStream).toBe(true);
    expect(result.streamWasNotNull).toBe(true);
    expect(result.sampleCount).toBeGreaterThanOrEqual(5);
    expect(result.noFace).toBe(true);
    expect(result.trackStates.length).toBeGreaterThan(0);
    expect(result.trackStates.every((s) => s === 'ended')).toBe(true);
    expect(result.statusAfterStop).toBe('idle');
    expect(result.streamAfterStop).toBeNull();
    watch.expectNoErrors();
  });

  test('stop during start releases the camera', async ({ page }) => {
    const watch = watchErrors(page, { ignore: MEDIAPIPE_LOG_IGNORE });
    await openApp(page, { query: 'camera=1' });

    const result = await page.evaluate(async () => {
      const pose = window.__notyTest!.modules.pose;
      const source = pose.createMediaPipePoseSource({ useGpu: false });
      const started = source.start();
      source.stop();
      await started;
      await new Promise((r) => setTimeout(r, 8000));
      return {
        status: source.getStatus(),
        stream: source.getVideoStream(),
        hidden: document.querySelectorAll('.pose-video-hidden').length,
      };
    });

    expect(result.status).toBe('idle');
    expect(result.stream).toBeNull();
    expect(result.hidden).toBe(0);
    watch.expectNoErrors();
  });
});
