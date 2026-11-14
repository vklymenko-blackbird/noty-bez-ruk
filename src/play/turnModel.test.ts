import { describe, expect, it } from 'vitest';
import { clampPage, turnNext, turnPrev } from './turnModel';

describe('clampPage', () => {
  it('keeps a page inside 1..pageCount', () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(-3, 5)).toBe(1);
    expect(clampPage(9, 5)).toBe(5);
    expect(clampPage(3, 5)).toBe(3);
  });

  it('rounds and handles non-finite numbers', () => {
    expect(clampPage(2.6, 5)).toBe(3);
    expect(clampPage(Number.NaN, 5)).toBe(1);
    expect(clampPage(Number.POSITIVE_INFINITY, 5)).toBe(1);
  });

  it('never returns less than 1 for a zero page count', () => {
    expect(clampPage(4, 0)).toBe(1);
  });
});

describe('turnNext, half-page on', () => {
  it('moves from a whole page to its half (N, false) -> (N, true)', () => {
    const r = turnNext({ page: 1, half: false }, 3, true);
    expect(r).toEqual({ pos: { page: 1, half: true }, changed: true, atEnd: false, atStart: false });
  });

  it('moves from a half to the next whole page (N, true) -> (N+1, false)', () => {
    const r = turnNext({ page: 1, half: true }, 3, true);
    expect(r.pos).toEqual({ page: 2, half: false });
    expect(r.changed).toBe(true);
  });

  it('on the last whole page does nothing and reports atEnd', () => {
    const r = turnNext({ page: 3, half: false }, 3, true);
    expect(r).toEqual({ pos: { page: 3, half: false }, changed: false, atEnd: true, atStart: false });
  });

  it('walks forward through 3 pages: (1,f) (1,t) (2,f) (2,t) (3,f) then atEnd', () => {
    let pos = { page: 1, half: false };
    const visits: string[] = [];
    for (let i = 0; i < 4; i++) {
      const r = turnNext(pos, 3, true);
      expect(r.changed).toBe(true);
      pos = r.pos;
      visits.push(`${pos.page}:${pos.half}`);
    }
    expect(visits).toEqual(['1:true', '2:false', '2:true', '3:false']);
    const last = turnNext(pos, 3, true);
    expect(last.atEnd).toBe(true);
    expect(last.changed).toBe(false);
    expect(last.pos).toEqual({ page: 3, half: false });
  });

  it('a half on the last page is not reachable, so the last whole page is the end', () => {
    const r = turnNext({ page: 2, half: true }, 3, true);
    expect(r.pos).toEqual({ page: 3, half: false });
  });
});

describe('turnNext, half-page off', () => {
  it('moves to the next whole page', () => {
    expect(turnNext({ page: 1, half: false }, 3, false).pos).toEqual({ page: 2, half: false });
  });

  it('reports atEnd on the last page', () => {
    const r = turnNext({ page: 3, half: false }, 3, false);
    expect(r.atEnd).toBe(true);
    expect(r.changed).toBe(false);
  });

  it('from a stray half position goes to the next whole page', () => {
    expect(turnNext({ page: 1, half: true }, 3, false).pos).toEqual({ page: 2, half: false });
  });
});

describe('turnPrev', () => {
  it('from a half goes back to the whole page (N, true) -> (N, false)', () => {
    const r = turnPrev({ page: 2, half: true }, 3, true);
    expect(r).toEqual({ pos: { page: 2, half: false }, changed: true, atEnd: false, atStart: false });
  });

  it('from a whole page goes to the previous whole page (N, false) -> (N-1, false)', () => {
    const r = turnPrev({ page: 3, half: false }, 3, true);
    expect(r.pos).toEqual({ page: 2, half: false });
    expect(r.changed).toBe(true);
  });

  it('on page 1 does nothing and reports atStart', () => {
    const r = turnPrev({ page: 1, half: false }, 3, true);
    expect(r).toEqual({ pos: { page: 1, half: false }, changed: false, atEnd: false, atStart: true });
  });

  it('works the same with half-page off', () => {
    expect(turnPrev({ page: 2, half: false }, 3, false).pos).toEqual({ page: 1, half: false });
  });

  it('walks back from the end: (3,f) -> (2,f) -> (1,f) then atStart', () => {
    let pos = { page: 3, half: false };
    const seen: string[] = [];
    for (let i = 0; i < 2; i++) {
      pos = turnPrev(pos, 3, true).pos;
      seen.push(`${pos.page}:${pos.half}`);
    }
    expect(seen).toEqual(['2:false', '1:false']);
    expect(turnPrev(pos, 3, true).atStart).toBe(true);
  });
});

describe('normalisation of illegal positions', () => {
  it('turns { last page, half: true } into { last page, false } before a prev step', () => {
    const r = turnPrev({ page: 3, half: true }, 3, true);
    expect(r.pos).toEqual({ page: 2, half: false });
    expect(r.changed).toBe(true);
  });

  it('a next on { last page, half: true } reports atEnd and returns the normalised position', () => {
    const r = turnNext({ page: 3, half: true }, 3, true);
    expect(r.atEnd).toBe(true);
    expect(r.changed).toBe(false);
    expect(r.pos).toEqual({ page: 3, half: false });
  });

  it('clamps a page beyond the score end', () => {
    const r = turnNext({ page: 9, half: false }, 3, true);
    expect(r.atEnd).toBe(true);
    expect(r.pos).toEqual({ page: 3, half: false });
  });

  it('a single-page score: next is atEnd, prev is atStart', () => {
    expect(turnNext({ page: 1, half: false }, 1, true).atEnd).toBe(true);
    expect(turnPrev({ page: 1, half: false }, 1, true).atStart).toBe(true);
  });
});
