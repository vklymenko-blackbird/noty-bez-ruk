import { describe, expect, it } from 'vitest';
import { MAX_MARKS_PER_PAGE, type Mark, type StampMark, type StrokeMark } from '../contracts';
import { hitTest, newId, validateMarks } from './model';

const stroke = (over: Partial<StrokeMark> = {}): StrokeMark => ({
  kind: 'stroke',
  id: 's1',
  color: 'ink',
  width: 0.004,
  points: [0.1, 0.1, 0.2, 0.1],
  ...over,
});

const stamp = (over: Partial<StampMark> = {}): StampMark => ({
  kind: 'stamp',
  id: 'p1',
  digit: 2,
  x: 0.5,
  y: 0.5,
  size: 0.03,
  color: 'blue',
  ...over,
});

describe('validateMarks', () => {
  it('keeps a valid stroke and a valid stamp', () => {
    const out = validateMarks([stroke(), stamp()]);
    expect(out).toEqual([stroke(), stamp()]);
  });

  it('returns [] when the input is not an array', () => {
    expect(validateMarks(null)).toEqual([]);
    expect(validateMarks({ kind: 'stroke' })).toEqual([]);
    expect(validateMarks('marks')).toEqual([]);
    expect(validateMarks(undefined)).toEqual([]);
  });

  it('drops items that are not objects', () => {
    expect(validateMarks([null, 42, 'x', undefined, stroke()])).toEqual([stroke()]);
  });

  it('drops an unknown kind', () => {
    expect(validateMarks([{ ...stroke(), kind: 'line' }])).toEqual([]);
  });

  it('drops a stroke with an unknown colour', () => {
    expect(validateMarks([stroke({ color: 'red' as never })])).toEqual([]);
  });

  it('drops a stroke with a missing or empty id', () => {
    expect(validateMarks([stroke({ id: '' })])).toEqual([]);
    expect(validateMarks([{ ...stroke(), id: 7 } as unknown])).toEqual([]);
  });

  it('drops a stroke with a non-finite width', () => {
    expect(validateMarks([stroke({ width: Number.NaN })])).toEqual([]);
    expect(validateMarks([stroke({ width: Number.POSITIVE_INFINITY })])).toEqual([]);
  });

  it('clamps stroke width to 0.001..0.05', () => {
    const [thin] = validateMarks([stroke({ width: 0 })]);
    const [thick] = validateMarks([stroke({ width: 1 })]);
    expect((thin as StrokeMark).width).toBe(0.001);
    expect((thick as StrokeMark).width).toBe(0.05);
  });

  it('drops a stroke with an odd or too short point list', () => {
    expect(validateMarks([stroke({ points: [0.1, 0.2, 0.3] })])).toEqual([]);
    expect(validateMarks([stroke({ points: [] })])).toEqual([]);
  });

  it('drops a stroke with more than 4000 numbers', () => {
    const points = new Array<number>(4002).fill(0.5);
    expect(validateMarks([stroke({ points })])).toEqual([]);
  });

  it('drops a stroke that holds a non-finite or non-number point', () => {
    expect(validateMarks([stroke({ points: [0.1, Number.NaN] })])).toEqual([]);
    expect(validateMarks([stroke({ points: [0.1, 'x' as unknown as number] })])).toEqual([]);
  });

  it('clamps each stroke point to 0..1', () => {
    const [m] = validateMarks([stroke({ points: [-0.5, 1.7, 0.3, 2] })]);
    expect((m as StrokeMark).points).toEqual([0, 1, 0.3, 1]);
  });

  it('drops a stamp with a digit outside 1..5 or not an integer', () => {
    expect(validateMarks([stamp({ digit: 0 as never })])).toEqual([]);
    expect(validateMarks([stamp({ digit: 6 as never })])).toEqual([]);
    expect(validateMarks([stamp({ digit: 2.5 as never })])).toEqual([]);
  });

  it('drops a stamp with non-finite coordinates or size', () => {
    expect(validateMarks([stamp({ x: Number.NaN })])).toEqual([]);
    expect(validateMarks([stamp({ y: Number.POSITIVE_INFINITY })])).toEqual([]);
    expect(validateMarks([stamp({ size: Number.NaN })])).toEqual([]);
  });

  it('clamps stamp position to 0..1 and size to 0.01..0.1', () => {
    const [m] = validateMarks([stamp({ x: -1, y: 3, size: 0.5 })]);
    expect(m).toMatchObject({ x: 0, y: 1, size: 0.1 });
    const [small] = validateMarks([stamp({ size: 0 })]);
    expect(small).toMatchObject({ size: 0.01 });
  });

  it('drops a mark with an unknown colour', () => {
    expect(validateMarks([stamp({ color: 'green' as never })])).toEqual([]);
  });

  it('keeps at most MAX_MARKS_PER_PAGE marks', () => {
    const many: Mark[] = Array.from({ length: MAX_MARKS_PER_PAGE + 25 }, (_, i) => stamp({ id: `p${i}` }));
    const out = validateMarks(many);
    expect(out).toHaveLength(MAX_MARKS_PER_PAGE);
    expect((out[0] as StampMark).id).toBe('p0');
  });
});

describe('hitTest', () => {
  it('stroke: hits a point on the line', () => {
    expect(hitTest(stroke(), 0.15, 0.1, 0)).toBe(true);
  });

  it('stroke: hits near the line within radius + half width', () => {
    // half width is 0.002, radius 0.01, so the limit is 0.012
    expect(hitTest(stroke(), 0.15, 0.111, 0.01)).toBe(true);
  });

  it('stroke: misses far from the line', () => {
    expect(hitTest(stroke(), 0.15, 0.2, 0.01)).toBe(false);
  });

  it('stroke: uses the end of the segment, not the infinite line', () => {
    // the point is on the extension of the segment, beyond x = 0.2
    expect(hitTest(stroke(), 0.5, 0.1, 0.01)).toBe(false);
    expect(hitTest(stroke(), 0.205, 0.1, 0.01)).toBe(true);
  });

  it('stroke: checks every segment of a polyline', () => {
    const m = stroke({ points: [0, 0, 0.1, 0, 0.1, 0.5] });
    expect(hitTest(m, 0.1, 0.4, 0)).toBe(true);
  });

  it('stroke with one point acts as a dot', () => {
    const dot = stroke({ points: [0.3, 0.3] });
    expect(hitTest(dot, 0.3, 0.305, 0.01)).toBe(true);
    expect(hitTest(dot, 0.3, 0.4, 0.01)).toBe(false);
  });

  it('stamp: hits near the centre and misses far away', () => {
    // size 0.03, half 0.015, radius 0.01, limit 0.025
    expect(hitTest(stamp(), 0.5, 0.52, 0.01)).toBe(true);
    expect(hitTest(stamp(), 0.5, 0.6, 0.01)).toBe(false);
  });
});

describe('newId', () => {
  it('returns a non-empty string and different values on each call', () => {
    const a = newId();
    const b = newId();
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});
