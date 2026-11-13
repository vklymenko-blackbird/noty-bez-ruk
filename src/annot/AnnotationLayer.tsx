import { useCallback, useEffect, useRef } from 'preact/hooks';
import type { AnnotationLayerProps, PenColor, StrokeMark } from '../contracts';
import { ERASER_RADIUS, HIGHLIGHTER_WIDTH, PEN_WIDTH, STAMP_SIZE } from '../contracts';
import { drawMarks } from '../annot/draw';
import { newId } from '../annot/model';
import { inkPalette } from '../paper';
import './annot.css';

/** Minimum distance between two stored points, in page fractions. */
const MIN_STEP = 0.002;
/** Flat [x, y, ...] list: 4000 numbers is 2000 points. */
const MAX_POINTS = 4000;

interface PendingStroke {
  page: number;
  color: PenColor;
  width: number;
  points: number[];
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Draws the marks of one page over the page box. Captures pointers only while editing. */
export default function AnnotationLayer({ session, page, crop, editing, paper, fingerDraw }: AnnotationLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pendingRef = useRef<PendingStroke | null>(null);
  const downRef = useRef(false);
  const latest = useRef({ session, page, crop, paper, fingerDraw, editing });
  latest.current = { session, page, crop, paper, fingerDraw, editing };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const cur = latest.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const marks = [...cur.session.getMarks(cur.page)];
    const pending = pendingRef.current;
    if (pending && pending.page === cur.page) {
      const live: StrokeMark = { kind: 'stroke', id: 'pending', color: pending.color, width: pending.width, points: pending.points };
      marks.push(live);
    }
    drawMarks(ctx, marks, { width: canvas.width, height: canvas.height, crop: cur.crop }, inkPalette(cur.paper));
  }, []);

  // Keep the backing store at CSS size times the device pixel ratio (at most 2).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * scale));
      const h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (w === canvas.width && h === canvas.height) return;
      canvas.width = w;
      canvas.height = h;
      redraw();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [redraw]);

  // Load the page and redraw when the session changes.
  useEffect(() => {
    pendingRef.current = null;
    downRef.current = false;
    let alive = true;
    const unsub = session.subscribe(() => {
      if (alive) redraw();
    });
    session.load(page).then(
      () => {
        if (alive) redraw();
      },
      () => {},
    );
    redraw();
    return () => {
      alive = false;
      unsub();
    };
  }, [session, page, redraw]);

  // Redraw when the crop or the paper changes.
  useEffect(() => {
    redraw();
  }, [crop.x, crop.y, crop.w, crop.h, paper, redraw]);

  // Leaving edit mode drops any stroke in progress.
  useEffect(() => {
    if (!editing) {
      pendingRef.current = null;
      downRef.current = false;
      redraw();
    }
  }, [editing, redraw]);

  const toPage = (e: PointerEvent): [number, number] => {
    const canvas = canvasRef.current;
    const c = latest.current.crop;
    if (!canvas) return [0, 0];
    const r = canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const x = c.x + (r.width > 0 ? px / r.width : 0) * c.w;
    const y = c.y + (r.height > 0 ? py / r.height : 0) * c.h;
    return [clamp01(x), clamp01(y)];
  };

  const accepts = (e: PointerEvent): boolean => {
    if (!latest.current.editing) return false;
    if (e.pointerType === 'touch') return latest.current.fingerDraw;
    return true;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!accepts(e)) return;
    const cur = latest.current;
    const tool = cur.session.getTool();
    const [x, y] = toPage(e);
    downRef.current = true;
    canvasRef.current?.setPointerCapture?.(e.pointerId);
    if (tool.tool === 'pen' || tool.tool === 'highlighter') {
      const highlight = tool.tool === 'highlighter';
      pendingRef.current = {
        page: cur.page,
        color: highlight ? 'highlight' : tool.color,
        width: highlight ? HIGHLIGHTER_WIDTH : PEN_WIDTH,
        points: [x, y],
      };
      redraw();
    } else if (tool.tool === 'eraser') {
      cur.session.eraseAt(cur.page, x, y, ERASER_RADIUS);
    } else if (tool.tool === 'stamp') {
      cur.session.addMark(cur.page, { kind: 'stamp', id: newId(), digit: tool.stampDigit, x, y, size: STAMP_SIZE, color: tool.color });
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!accepts(e) || !downRef.current) return;
    const cur = latest.current;
    const pending = pendingRef.current;
    if (pending) {
      const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      const events: PointerEvent[] = coalesced.length > 0 ? coalesced : [e];
      for (const ev of events) {
        if (pending.points.length >= MAX_POINTS) break;
        const [x, y] = toPage(ev);
        const n = pending.points.length;
        if (Math.hypot(x - pending.points[n - 2], y - pending.points[n - 1]) < MIN_STEP) continue;
        pending.points.push(x, y);
      }
      redraw();
    } else if (cur.session.getTool().tool === 'eraser') {
      const [x, y] = toPage(e);
      cur.session.eraseAt(cur.page, x, y, ERASER_RADIUS);
    }
  };

  const finishStroke = (e: PointerEvent, keep: boolean) => {
    if (!downRef.current) return;
    downRef.current = false;
    canvasRef.current?.releasePointerCapture?.(e.pointerId);
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (keep && pending && pending.page === latest.current.page) {
      latest.current.session.addMark(pending.page, {
        kind: 'stroke',
        id: newId(),
        color: pending.color,
        width: pending.width,
        points: pending.points,
      });
    }
    redraw();
  };

  return (
    <canvas
      ref={canvasRef}
      class={editing ? 'annot-layer annot-layer--editing' : 'annot-layer'}
      data-testid="annot-layer"
      data-nav-ignore={editing ? true : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finishStroke(e, true)}
      onPointerCancel={(e) => finishStroke(e, false)}
    />
  );
}
