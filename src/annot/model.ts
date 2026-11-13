import type { Mark } from '../contracts';

/** STUB: replaced by package annot-engine. */
export function validateMarks(_raw: unknown): Mark[] {
  return [];
}

/** STUB: replaced by package annot-engine. */
export function hitTest(_mark: Mark, _x: number, _y: number, _radius: number): boolean {
  return false;
}

let seq = 0;
export function newId(): string {
  seq += 1;
  return `m-${Date.now().toString(36)}-${seq}`;
}
