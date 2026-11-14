import type { TurnPosition, TurnResult } from '../contracts';

/** Keeps a page number inside 1..pageCount. Non-numbers become page 1. */
export function clampPage(page: number, pageCount: number): number {
  const p = Number.isFinite(page) ? Math.round(page) : 1;
  return Math.min(Math.max(1, pageCount), Math.max(1, p));
}

/**
 * Brings a position into a legal state.
 * A half position on the last page cannot exist, so it becomes the whole last page.
 * SPEC 1.6 is the source of truth for this model.
 */
function normalise(pos: TurnPosition, pageCount: number): TurnPosition {
  const page = clampPage(pos.page, pageCount);
  return { page, half: pos.half && page < pageCount };
}

function same(a: TurnPosition, b: TurnPosition): boolean {
  return a.page === b.page && a.half === b.half;
}

/**
 * Next step (SPEC 1.6).
 * - Half mode, whole page N: show the bottom half of N+1 (top part shows N+1).
 * - Half mode, half N: show whole page N+1.
 * - Half mode off: whole page N+1.
 * - On the last page nothing changes and atEnd is true.
 */
export function turnNext(pos: TurnPosition, pageCount: number, halfEnabled: boolean): TurnResult {
  const cur = normalise(pos, pageCount);
  let next: TurnPosition;
  if (cur.half) {
    next = { page: cur.page + 1, half: false };
  } else if (cur.page >= pageCount) {
    return { pos: cur, changed: false, atEnd: true, atStart: false };
  } else if (halfEnabled) {
    next = { page: cur.page, half: true };
  } else {
    next = { page: cur.page + 1, half: false };
  }
  return { pos: next, changed: !same(next, cur), atEnd: false, atStart: false };
}

/**
 * Previous step (SPEC 1.6).
 * - Half position {N, true} (top shows N+1): back to whole page N.
 * - Whole page N > 1: whole page N-1.
 * - On page 1 nothing changes and atStart is true.
 */
export function turnPrev(pos: TurnPosition, pageCount: number, _halfEnabled: boolean): TurnResult {
  const cur = normalise(pos, pageCount);
  if (cur.half) {
    const back = { page: cur.page, half: false };
    return { pos: back, changed: true, atEnd: false, atStart: false };
  }
  if (cur.page <= 1) {
    return { pos: cur, changed: false, atEnd: false, atStart: true };
  }
  return { pos: { page: cur.page - 1, half: false }, changed: true, atEnd: false, atStart: false };
}
