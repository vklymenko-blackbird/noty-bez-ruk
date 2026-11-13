import type { PoseSource } from '../contracts';
import { isTestMode, testFlag } from '../app/testMode';
import { settings } from '../settings';
import { getInjectedPoseSource } from './injected';
import { createMediaPipePoseSource } from './mediapipe';

export { getInjectedPoseSource, createInjectedPoseSource } from './injected';
export { createMediaPipePoseSource } from './mediapipe';
export { yawFromMatrix, yawFromLandmarks, mouthFromBlendshapes } from './yaw';

/** The injected source in test mode (unless &camera=1), else MediaPipe. */
export function createPoseSource(): PoseSource {
  if (isTestMode() && !testFlag('camera')) return getInjectedPoseSource();
  return createMediaPipePoseSource({ useGpu: settings.get().useGpu });
}
