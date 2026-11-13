import { describe, expect, it } from 'vitest';
import { mouthFromBlendshapes, pitchFromMatrix, yawFromLandmarks, yawFromMatrix } from './yaw';

/** Column-major 4x4 rotation about the vertical (Y) axis by angle a (degrees). */
function yRot(aDeg: number): number[] {
  const a = (aDeg * Math.PI) / 180;
  const s = Math.sin(a);
  const c = Math.cos(a);
  // column-major: column 0 = [c,0,-s,0], column 2 = [s,0,c,0]
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}

/** Column-major 4x4 rotation about the X axis by angle a (degrees). */
function xRot(aDeg: number): number[] {
  const a = (aDeg * Math.PI) / 180;
  const s = Math.sin(a);
  const c = Math.cos(a);
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

describe('yawFromMatrix', () => {
  it('turn to the user right (a = -20 deg) gives about +20', () => {
    expect(yawFromMatrix(yRot(-20))).toBeCloseTo(20, 5);
  });
  it('a = +15 gives about -15', () => {
    expect(yawFromMatrix(yRot(15))).toBeCloseTo(-15, 5);
  });
  it('identity gives 0', () => {
    expect(yawFromMatrix(IDENTITY)).toBeCloseTo(0, 9);
  });
});

describe('pitchFromMatrix', () => {
  it('is 0 for identity and for a pure yaw matrix', () => {
    expect(pitchFromMatrix(IDENTITY)).toBeCloseTo(0, 9);
    expect(pitchFromMatrix(yRot(-20))).toBeCloseTo(0, 9);
  });
  it('is about 20 in size for a 20 degree rotation about the X axis', () => {
    expect(Math.abs(pitchFromMatrix(xRot(20)))).toBeCloseTo(20, 5);
  });
});

describe('yawFromLandmarks', () => {
  function face(noseX: number): { x: number; y: number }[] {
    const lm = Array.from({ length: 300 }, () => ({ x: 0.5, y: 0.5 }));
    lm[33] = { x: 0.4, y: 0.4 };
    lm[263] = { x: 0.6, y: 0.4 };
    lm[1] = { x: noseX, y: 0.5 };
    return lm;
  }
  it('nose left of the eye midpoint gives a positive yaw', () => {
    expect(yawFromLandmarks(face(0.45))).toBeGreaterThan(0);
  });
  it('nose right of the midpoint gives a negative yaw', () => {
    expect(yawFromLandmarks(face(0.55))).toBeLessThan(0);
  });
  it('nose at the midpoint gives 0', () => {
    expect(yawFromLandmarks(face(0.5))).toBeCloseTo(0, 9);
  });
  it('clamps to 60 degrees', () => {
    expect(yawFromLandmarks(face(-5))).toBe(60);
  });
  it('returns 0 for missing landmarks or tiny eye distance', () => {
    expect(yawFromLandmarks([])).toBe(0);
    const lm = face(0.45);
    lm[263] = { x: 0.4, y: 0.4 };
    expect(yawFromLandmarks(lm)).toBe(0);
  });
});

describe('mouthFromBlendshapes', () => {
  it('maps mouthLeft and mouthRight scores', () => {
    expect(
      mouthFromBlendshapes([
        { categoryName: 'mouthLeft', score: 0.7 },
        { categoryName: 'jawOpen', score: 0.9 },
        { categoryName: 'mouthRight', score: 0.2 },
      ]),
    ).toEqual({ mouthLeft: 0.7, mouthRight: 0.2 });
  });
  it('returns 0 for missing names', () => {
    expect(mouthFromBlendshapes([])).toEqual({ mouthLeft: 0, mouthRight: 0 });
    expect(mouthFromBlendshapes([{ categoryName: 'mouthRight', score: 0.4 }])).toEqual({ mouthLeft: 0, mouthRight: 0.4 });
  });
});
