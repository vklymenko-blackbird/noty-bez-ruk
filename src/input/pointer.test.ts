import { afterEach, describe, expect, it } from 'vitest';
import type { NavAction } from '../contracts';
import { attachPointerNav, zoneForPoint } from './pointer';

interface PointerFields {
  pointerId?: number;
  pointerType?: string;
  clientX?: number;
  clientY?: number;
  timeStamp?: number;
}

/** A pointer-like event. happy-dom may lack PointerEvent, so the fields are set directly. */
function pe(type: string, target: EventTarget, f: PointerFields): Event {
  const e = new Event(type, { bubbles: true, cancelable: true });
  const fields: Required<PointerFields> = {
    pointerId: 1,
    pointerType: 'touch',
    clientX: 0,
    clientY: 0,
    timeStamp: 0,
    ...f,
  };
  for (const [k, v] of Object.entries(fields)) {
    Object.defineProperty(e, k, { value: v });
  }
  Object.defineProperty(e, 'target', { value: target });
  return e;
}

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
  document.body.replaceChildren();
});

/** A 300 px wide element at x = 100 (left edge 100, right edge 400). */
function makeEl(): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({ left: 100, top: 0, width: 300, height: 600, right: 400, bottom: 600, x: 100, y: 0, toJSON() {} }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

function setup(opts?: { ignorePen?: boolean }) {
  const el = makeEl();
  const calls: NavAction[] = [];
  const detach = attachPointerNav(el, (a) => calls.push(a), opts);
  cleanups.push(detach);
  return { el, calls, detach };
}

/** Runs one whole gesture: down at (x0,y0) at t0, then up at (x1,y1) at t1. */
function gesture(el: HTMLElement, from: [number, number, number], to: [number, number, number], id = 1, type = 'touch') {
  el.dispatchEvent(pe('pointerdown', el, { pointerId: id, pointerType: type, clientX: from[0], clientY: from[1], timeStamp: from[2] }));
  el.dispatchEvent(pe('pointerup', el, { pointerId: id, pointerType: type, clientX: to[0], clientY: to[1], timeStamp: to[2] }));
}

describe('zoneForPoint', () => {
  it('left third is prev, centre is menu, right third is next', () => {
    expect(zoneForPoint(0, 300)).toBe('prev');
    expect(zoneForPoint(99, 300)).toBe('prev');
    expect(zoneForPoint(150, 300)).toBe('menu');
    expect(zoneForPoint(201, 300)).toBe('next');
    expect(zoneForPoint(300, 300)).toBe('next');
  });

  it('a zero width is menu', () => {
    expect(zoneForPoint(10, 0)).toBe('menu');
  });
});

describe('attachPointerNav taps', () => {
  it('a tap in the left third gives prev', () => {
    const { el, calls } = setup();
    gesture(el, [120, 300, 0], [120, 300, 100]);
    expect(calls).toEqual(['prev']);
  });

  it('a tap in the centre third gives menu', () => {
    const { el, calls } = setup();
    gesture(el, [250, 300, 0], [250, 300, 100]);
    expect(calls).toEqual(['menu']);
  });

  it('a tap in the right third gives next', () => {
    const { el, calls } = setup();
    gesture(el, [390, 300, 0], [390, 300, 100]);
    expect(calls).toEqual(['next']);
  });

  it('the zone uses the position relative to the element rect', () => {
    const { el, calls } = setup();
    // clientX 150 is 50 px into the element (width 300): left third
    gesture(el, [150, 300, 0], [150, 300, 80]);
    expect(calls).toEqual(['prev']);
  });

  it('a slow press (500 ms or more) gives nothing', () => {
    const { el, calls } = setup();
    gesture(el, [390, 300, 0], [390, 300, 500]);
    expect(calls).toEqual([]);
  });

  it('a press of 499 ms still counts as a tap', () => {
    const { el, calls } = setup();
    gesture(el, [390, 300, 0], [390, 300, 499]);
    expect(calls).toEqual(['next']);
  });

  it('a move of 10 px or more is not a tap', () => {
    const { el, calls } = setup();
    gesture(el, [390, 300, 0], [400, 300, 50]);
    expect(calls).toEqual([]);
  });

  it('a move just under 10 px is still a tap', () => {
    const { el, calls } = setup();
    gesture(el, [390, 300, 0], [396, 303, 50]);
    expect(calls).toEqual(['next']);
  });
});

describe('attachPointerNav swipes', () => {
  it('a swipe left gives next', () => {
    const { el, calls } = setup();
    gesture(el, [300, 300, 0], [220, 300, 200]);
    expect(calls).toEqual(['next']);
  });

  it('a swipe right gives prev', () => {
    const { el, calls } = setup();
    gesture(el, [200, 300, 0], [280, 300, 200]);
    expect(calls).toEqual(['prev']);
  });

  it('a swipe shorter than 48 px gives nothing', () => {
    const { el, calls } = setup();
    gesture(el, [300, 300, 0], [260, 300, 200]);
    expect(calls).toEqual([]);
  });

  it('a swipe of exactly 48 px counts', () => {
    const { el, calls } = setup();
    gesture(el, [300, 300, 0], [252, 300, 200]);
    expect(calls).toEqual(['next']);
  });

  it('a mostly vertical move gives nothing', () => {
    const { el, calls } = setup();
    gesture(el, [300, 300, 0], [250, 370, 200]);
    expect(calls).toEqual([]);
  });

  it('a diagonal move passes when |dx| > 1.5 * |dy|', () => {
    const { el, calls } = setup();
    gesture(el, [300, 300, 0], [240, 330, 200]);
    expect(calls).toEqual(['next']);
  });

  it('a swipe of 600 ms or more gives nothing', () => {
    const { el, calls } = setup();
    gesture(el, [300, 300, 0], [200, 300, 600]);
    expect(calls).toEqual([]);
  });
});

describe('attachPointerNav multi-touch and cancel', () => {
  it('a second pointer cancels the gesture', () => {
    const { el, calls } = setup();
    el.dispatchEvent(pe('pointerdown', el, { pointerId: 1, clientX: 390, clientY: 300, timeStamp: 0 }));
    el.dispatchEvent(pe('pointerdown', el, { pointerId: 2, clientX: 200, clientY: 300, timeStamp: 10 }));
    el.dispatchEvent(pe('pointerup', el, { pointerId: 1, clientX: 390, clientY: 300, timeStamp: 100 }));
    el.dispatchEvent(pe('pointerup', el, { pointerId: 2, clientX: 200, clientY: 300, timeStamp: 110 }));
    expect(calls).toEqual([]);
  });

  it('does not track a new pointer while an earlier one is still down', () => {
    const { el, calls } = setup();
    el.dispatchEvent(pe('pointerdown', el, { pointerId: 1, clientX: 390, clientY: 300, timeStamp: 0 }));
    el.dispatchEvent(pe('pointerdown', el, { pointerId: 2, clientX: 200, clientY: 300, timeStamp: 10 }));
    el.dispatchEvent(pe('pointerup', el, { pointerId: 1, clientX: 390, clientY: 300, timeStamp: 50 }));
    el.dispatchEvent(pe('pointerdown', el, { pointerId: 3, clientX: 390, clientY: 300, timeStamp: 60 }));
    el.dispatchEvent(pe('pointerup', el, { pointerId: 3, clientX: 390, clientY: 300, timeStamp: 80 }));
    el.dispatchEvent(pe('pointerup', el, { pointerId: 2, clientX: 200, clientY: 300, timeStamp: 90 }));
    expect(calls).toEqual([]);
  });

  it('a new gesture works after every pointer is up', () => {
    const { el, calls } = setup();
    el.dispatchEvent(pe('pointerdown', el, { pointerId: 1, clientX: 390, clientY: 300, timeStamp: 0 }));
    el.dispatchEvent(pe('pointerdown', el, { pointerId: 2, clientX: 200, clientY: 300, timeStamp: 10 }));
    el.dispatchEvent(pe('pointerup', el, { pointerId: 1, clientX: 390, clientY: 300, timeStamp: 50 }));
    el.dispatchEvent(pe('pointerup', el, { pointerId: 2, clientX: 200, clientY: 300, timeStamp: 60 }));
    gesture(el, [390, 300, 100], [390, 300, 150], 4);
    expect(calls).toEqual(['next']);
  });

  it('pointercancel gives nothing', () => {
    const { el, calls } = setup();
    el.dispatchEvent(pe('pointerdown', el, { pointerId: 1, clientX: 390, clientY: 300, timeStamp: 0 }));
    el.dispatchEvent(pe('pointercancel', el, { pointerId: 1, clientX: 390, clientY: 300, timeStamp: 50 }));
    el.dispatchEvent(pe('pointerup', el, { pointerId: 1, clientX: 390, clientY: 300, timeStamp: 60 }));
    expect(calls).toEqual([]);
  });

  it('a pointerup for a pointer that was never tracked gives nothing', () => {
    const { el, calls } = setup();
    el.dispatchEvent(pe('pointerup', el, { pointerId: 9, clientX: 390, clientY: 300, timeStamp: 60 }));
    expect(calls).toEqual([]);
  });
});

describe('attachPointerNav ignore rules', () => {
  it('a pointer that starts inside [data-nav-ignore] never navigates', () => {
    const { el, calls } = setup();
    const handle = document.createElement('button');
    handle.setAttribute('data-nav-ignore', '');
    el.appendChild(handle);
    gesture(handle, [390, 300, 0], [390, 300, 100]);
    expect(calls).toEqual([]);
  });

  it('a pointer on a normal child element still navigates', () => {
    const { el, calls } = setup();
    const child = document.createElement('span');
    el.appendChild(child);
    gesture(child, [390, 300, 0], [390, 300, 100]);
    expect(calls).toEqual(['next']);
  });

  it('ignorePen: a pen tap gives nothing', () => {
    const { el, calls } = setup({ ignorePen: true });
    gesture(el, [390, 300, 0], [390, 300, 100], 1, 'pen');
    expect(calls).toEqual([]);
  });

  it('ignorePen: a finger tap still works', () => {
    const { el, calls } = setup({ ignorePen: true });
    gesture(el, [390, 300, 0], [390, 300, 100], 1, 'touch');
    expect(calls).toEqual(['next']);
  });

  it('without ignorePen a pen tap works', () => {
    const { el, calls } = setup();
    gesture(el, [390, 300, 0], [390, 300, 100], 1, 'pen');
    expect(calls).toEqual(['next']);
  });
});

describe('attachPointerNav detach', () => {
  it('the returned function removes all listeners', () => {
    const { el, calls, detach } = setup();
    detach();
    gesture(el, [390, 300, 0], [390, 300, 100]);
    expect(calls).toEqual([]);
  });
});
