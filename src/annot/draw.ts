import type { CropBox, Mark, PenColor } from '../contracts';

/**
 * Draws marks on a canvas. Does not clear the canvas first.
 * Page coordinates (0..1 of the full page) map to view pixels through the crop box.
 */
export function drawMarks(
  ctx: CanvasRenderingContext2D,
  marks: Mark[],
  view: { width: number; height: number; crop: CropBox },
  palette: Record<PenColor, string>,
): void {
  const { crop } = view;
  if (!(crop.w > 0) || !(crop.h > 0)) return;

  const toX = (x: number): number => ((x - crop.x) / crop.w) * view.width;
  const toY = (y: number): number => ((y - crop.y) / crop.h) * view.height;
  const toPx = (v: number): number => (v / crop.w) * view.width;

  for (const mark of marks) {
    if (mark.kind === 'stroke') {
      drawStroke(ctx, mark, palette[mark.color], toX, toY, toPx);
    } else if (mark.kind === 'stamp') {
      ctx.fillStyle = palette[mark.color];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${toPx(mark.size)}px "Commissioner Variable", sans-serif`;
      ctx.fillText(String(mark.digit), toX(mark.x), toY(mark.y));
    }
  }
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  mark: Extract<Mark, { kind: 'stroke' }>,
  color: string,
  toX: (x: number) => number,
  toY: (y: number) => number,
  toPx: (v: number) => number,
): void {
  const n = Math.floor(mark.points.length / 2);
  if (n === 0) return;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    pts.push([toX(mark.points[i * 2]), toY(mark.points[i * 2 + 1])]);
  }
  const lineWidth = toPx(mark.width);

  if (n === 1) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  // Smooth the middle of the line: curve through each point towards the midpoint of the next segment.
  for (let i = 1; i < n - 1; i++) {
    const [cx, cy] = pts[i];
    const mx = (cx + pts[i + 1][0]) / 2;
    const my = (cy + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(cx, cy, mx, my);
  }
  const last = pts[n - 1];
  ctx.lineTo(last[0], last[1]);
  ctx.stroke();
}
