/**
 * Pure pose math. No DOM, no MediaPipe imports.
 * Sign convention (SPEC 1.6): positive yaw = the user's head turns to the user's own right.
 */

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Yaw in degrees from the 4x4 column-major facial transformation matrix.
 * For a rotation about the vertical axis by angle a: m[8] = sin a, m[10] = cos a.
 * A turn to the user's own right is a negative a, so the result is positive.
 */
export function yawFromMatrix(m: ArrayLike<number>): number {
  return -Math.atan2(m[8], m[10]) * RAD_TO_DEG;
}

/**
 * Pitch in degrees from the same matrix. Zero for a pure turn about the vertical axis.
 * The sign is unverified on a real device. The engine uses only the change from the calibrated value.
 */
export function pitchFromMatrix(m: ArrayLike<number>): number {
  return Math.atan2(-m[9], Math.hypot(m[8], m[10])) * RAD_TO_DEG;
}

/**
 * Fallback yaw from face landmarks (MediaPipe indices: nose 1, eyes 33 and 263).
 * Nose x falls in the raw (unmirrored) frame when the user turns right, so the result is positive.
 * Returns 0 when the eyes are too close together or a landmark is missing.
 */
export function yawFromLandmarks(lm: { x: number; y: number }[]): number {
  const nose = lm[1];
  const eyeA = lm[33];
  const eyeB = lm[263];
  if (!nose || !eyeA || !eyeB) return 0;
  const mid = (eyeA.x + eyeB.x) / 2;
  const d = Math.abs(eyeB.x - eyeA.x);
  if (d < 0.0001) return 0;
  const ratio = (nose.x - mid) / d;
  return -clamp(ratio * 90, -60, 60);
}

/**
 * Mouth pull from blendshape scores. Missing names count as 0.
 * Note: the side is unverified on a real device; Settings.flipDirection covers it.
 */
export function mouthFromBlendshapes(cats: { categoryName: string; score: number }[]): { mouthLeft: number; mouthRight: number } {
  let mouthLeft = 0;
  let mouthRight = 0;
  for (const c of cats) {
    if (c.categoryName === 'mouthLeft') mouthLeft = c.score;
    else if (c.categoryName === 'mouthRight') mouthRight = c.score;
  }
  return { mouthLeft, mouthRight };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
