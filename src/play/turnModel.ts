import type { TurnPosition, TurnResult } from '../contracts';

export function clampPage(page: number, pageCount: number): number {
  const p = Number.isFinite(page) ? Math.round(page) : 1;
  return Math.min(Math.max(1, pageCount), Math.max(1, p));
}

/** STUB: replaced by package play-logic. Whole pages only. */
export function turnNext(pos: TurnPosition, pageCount: number, _halfEnabled: boolean): TurnResult {
  if (pos.page >= pageCount) return { pos, changed: false, atEnd: true, atStart: false };
  return { pos: { page: pos.page + 1, half: false }, changed: true, atEnd: false, atStart: false };
}

/** STUB: replaced by package play-logic. Whole pages only. */
export function turnPrev(pos: TurnPosition, _pageCount: number, _halfEnabled: boolean): TurnResult {
  if (pos.page <= 1) return { pos, changed: false, atEnd: false, atStart: true };
  return { pos: { page: pos.page - 1, half: false }, changed: true, atEnd: false, atStart: false };
}
