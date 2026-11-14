import { describe, expect, it } from 'vitest';
import { FULL_PAGE, type CropBox, type Mark, type PenColor } from '../contracts';
import { drawMarks } from './draw';

type Call = { name: string; args: unknown[] };

/** A fake 2D context that records calls and property writes. */
function fakeCtx() {
  const calls: Call[] = [];
  const props: Record<string, unknown> = {};
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push({ name, args });
    };
  const ctx = new Proxy(
    {},
    {
      get(_t, key: string) {
        if (key in props) return props[key];
        return record(key);
      },
      set(_t, key: string, value) {
        props[key] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, props };
}

const palette: Record<PenColor, string> = {
  ink: '#000001',
  burgundy: '#800020',
  blue: '#0000ff',
  highlight: '#ffff00',
};

const view = (crop: CropBox = FULL_PAGE) => ({ width: 1000, height: 800, crop });

describe('drawMarks', () => {
  it('draws nothing for an empty list', () => {
    const { ctx, calls } = fakeCtx();
    drawMarks(ctx, [], view(), palette);
    expect(calls).toEqual([]);
  });

  it('maps a stroke point to view pixels with the full page', () => {
    const { ctx, calls, props } = fakeCtx();
    const mark: Mark = { kind: 'stroke', id: 's', color: 'blue', width: 0.01, points: [0.5, 0.25, 0.75, 0.25] };
    drawMarks(ctx, [mark], view(), palette);
    const move = calls.find((c) => c.name === 'moveTo');
    const line = calls.find((c) => c.name === 'lineTo');
    expect(move?.args).toEqual([500, 200]);
    expect(line?.args).toEqual([750, 200]);
    expect(props.strokeStyle).toBe(palette.blue);
    expect(props.lineCap).toBe('round');
    expect(props.lineJoin).toBe('round');
    expect(calls.some((c) => c.name === 'stroke')).toBe(true);
  });

  it('scales the line width by the view width', () => {
    const { ctx, props } = fakeCtx();
    const mark: Mark = { kind: 'stroke', id: 's', color: 'ink', width: 0.01, points: [0.1, 0.1, 0.2, 0.2] };
    drawMarks(ctx, [mark], view(), palette);
    expect(props.lineWidth).toBeCloseTo(10);
  });

  it('maps coordinates through a crop box', () => {
    const { ctx, calls } = fakeCtx();
    const crop: CropBox = { x: 0.25, y: 0.5, w: 0.5, h: 0.25 };
    const mark: Mark = { kind: 'stroke', id: 's', color: 'ink', width: 0.01, points: [0.5, 0.625, 0.75, 0.625] };
    drawMarks(ctx, [mark], view(crop), palette);
    // vx = (0.5 - 0.25) / 0.5 * 1000 = 500; vy = (0.625 - 0.5) / 0.25 * 800 = 400
    expect(calls.find((c) => c.name === 'moveTo')?.args).toEqual([500, 400]);
    expect(calls.find((c) => c.name === 'lineTo')?.args).toEqual([1000, 400]);
  });

  it('scales the line width with the crop width', () => {
    const { ctx, props } = fakeCtx();
    const crop: CropBox = { x: 0, y: 0, w: 0.5, h: 1 };
    const mark: Mark = { kind: 'stroke', id: 's', color: 'ink', width: 0.01, points: [0.1, 0.1, 0.2, 0.2] };
    drawMarks(ctx, [mark], view(crop), palette);
    // 0.01 / 0.5 * 1000 = 20
    expect(props.lineWidth).toBeCloseTo(20);
  });

  it('smooths a polyline with quadratic curves through the midpoints', () => {
    const { ctx, calls } = fakeCtx();
    const mark: Mark = {
      kind: 'stroke',
      id: 's',
      color: 'ink',
      width: 0.01,
      points: [0.1, 0.1, 0.2, 0.1, 0.3, 0.2, 0.4, 0.2],
    };
    drawMarks(ctx, [mark], view(), palette);
    const curves = calls.filter((c) => c.name === 'quadraticCurveTo');
    expect(curves).toHaveLength(2);
    // view height 800: y 0.1 -> 80, y 0.2 -> 160
    expect(curves[0].args).toEqual([200, 80, 250, 120]);
    expect(curves[1].args).toEqual([300, 160, 350, 160]);
    expect(calls.find((c) => c.name === 'lineTo')?.args).toEqual([400, 160]);
  });

  it('draws a stroke with one point as a filled dot', () => {
    const { ctx, calls, props } = fakeCtx();
    const mark: Mark = { kind: 'stroke', id: 's', color: 'burgundy', width: 0.01, points: [0.5, 0.5] };
    drawMarks(ctx, [mark], view(), palette);
    const arc = calls.find((c) => c.name === 'arc');
    expect(arc?.args.slice(0, 3)).toEqual([500, 400, 5]);
    expect(calls.some((c) => c.name === 'fill')).toBe(true);
    expect(calls.some((c) => c.name === 'stroke')).toBe(false);
    expect(props.fillStyle).toBe(palette.burgundy);
  });

  it('a stamp calls fillText with its digit at the mapped centre', () => {
    const { ctx, calls } = fakeCtx();
    const mark: Mark = { kind: 'stamp', id: 'p', digit: 4, x: 0.5, y: 0.25, size: 0.03, color: 'ink' };
    drawMarks(ctx, [mark], view(), palette);
    const text = calls.find((c) => c.name === 'fillText');
    expect(text?.args).toEqual(['4', 500, 200]);
  });

  it('a stamp uses a font size scaled by the view width', () => {
    const { ctx, props } = fakeCtx();
    const mark: Mark = { kind: 'stamp', id: 'p', digit: 1, x: 0.5, y: 0.5, size: 0.03, color: 'blue' };
    drawMarks(ctx, [mark], view(), palette);
    expect(props.font).toBe('600 30px "Commissioner Variable", sans-serif');
    expect(props.textAlign).toBe('center');
    expect(props.textBaseline).toBe('middle');
    expect(props.fillStyle).toBe(palette.blue);
  });

  it('does not clear the canvas', () => {
    const { ctx, calls } = fakeCtx();
    const mark: Mark = { kind: 'stroke', id: 's', color: 'ink', width: 0.01, points: [0.1, 0.1, 0.2, 0.2] };
    drawMarks(ctx, [mark], view(), palette);
    expect(calls.some((c) => c.name === 'clearRect')).toBe(false);
  });

  it('draws nothing for a crop box with zero width', () => {
    const { ctx, calls } = fakeCtx();
    const mark: Mark = { kind: 'stroke', id: 's', color: 'ink', width: 0.01, points: [0.1, 0.1, 0.2, 0.2] };
    drawMarks(ctx, [mark], view({ x: 0, y: 0, w: 0, h: 1 }), palette);
    expect(calls).toEqual([]);
  });
});
