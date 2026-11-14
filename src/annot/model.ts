import { MAX_MARKS_PER_PAGE, type Mark, type PenColor, type StampMark, type StrokeMark } from '../contracts';

const PEN_COLORS: readonly PenColor[] = ['ink', 'burgundy', 'blue', 'highlight'];
const MAX_POINT_COUNT = 4000;

type Raw = Record<string, unknown>;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function isPenColor(v: unknown): v is PenColor {
  return typeof v === 'string' && (PEN_COLORS as readonly string[]).includes(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function parseStroke(raw: Raw): StrokeMark | null {
  if (!isNonEmptyString(raw.id) || !isPenColor(raw.color) || !isFiniteNumber(raw.width)) return null;
  const pts = raw.points;
  if (!Array.isArray(pts) || pts.length < 2 || pts.length > MAX_POINT_COUNT || pts.length % 2 !== 0) return null;
  const points: number[] = [];
  for (const p of pts) {
    if (!isFiniteNumber(p)) return null;
    points.push(clamp(p, 0, 1));
  }
  return { kind: 'stroke', id: raw.id, color: raw.color, width: clamp(raw.width, 0.001, 0.05), points };
}

function parseStamp(raw: Raw): StampMark | null {
  const { id, digit, x, y, size, color } = raw;
  if (!isNonEmptyString(id) || !isPenColor(color)) return null;
  if (!isFiniteNumber(digit) || !Number.isInteger(digit) || digit < 1 || digit > 5) return null;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(size)) return null;
  return {
    kind: 'stamp',
    id,
    digit: digit as StampMark['digit'],
    x: clamp(x, 0, 1),
    y: clamp(y, 0, 1),
    size: clamp(size, 0.01, 0.1),
    color,
  };
}

function parseMark(raw: unknown): Mark | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Raw;
  if (obj.kind === 'stroke') return parseStroke(obj);
  if (obj.kind === 'stamp') return parseStamp(obj);
  return null;
}

/** Returns only the valid marks. Never throws. Keeps at most MAX_MARKS_PER_PAGE marks. */
export function validateMarks(raw: unknown): Mark[] {
  if (!Array.isArray(raw)) return [];
  const out: Mark[] = [];
  for (const item of raw) {
    if (out.length >= MAX_MARKS_PER_PAGE) break;
    const mark = parseMark(item);
    if (mark) out.push(mark);
  }
  return out;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** True when the point (x, y) is within radius of the mark's visible shape. */
export function hitTest(mark: Mark, x: number, y: number, radius: number): boolean {
  if (mark.kind === 'stamp') {
    return Math.hypot(x - mark.x, y - mark.y) <= radius + mark.size / 2;
  }
  if (mark.kind !== 'stroke') return false;
  const limit = radius + mark.width / 2;
  const n = Math.floor(mark.points.length / 2);
  if (n === 0) return false;
  if (n === 1) return Math.hypot(x - mark.points[0], y - mark.points[1]) <= limit;
  for (let i = 0; i < n - 1; i++) {
    const d = distToSegment(
      x,
      y,
      mark.points[i * 2],
      mark.points[i * 2 + 1],
      mark.points[i * 2 + 2],
      mark.points[i * 2 + 3],
    );
    if (d <= limit) return true;
  }
  return false;
}

/** A unique id. Uses crypto.randomUUID when it exists. */
export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
