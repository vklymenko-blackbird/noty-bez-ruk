import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, fireEvent, screen, waitFor, cleanup } from '@testing-library/preact';
import type { PdfDoc, TurnPosition } from '../contracts';
import type { NavAction } from '../contracts';
import { attachPointerNav } from '../input';
import PageView from './PageView';

// happy-dom has no layout: give every element a size so PageView starts to render.
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 600 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 800 });
});

afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
});

/** A document whose pages in `broken` fail to render until the test repairs them. */
function fakeDoc(broken: Set<number>): PdfDoc & { calls: number[] } {
  const calls: number[] = [];
  return {
    pageCount: 4,
    calls,
    async getPageSize() {
      return { width: 600, height: 800 };
    },
    async renderPage(page) {
      calls.push(page);
      if (broken.has(page)) throw new Error('render failed');
      return document.createElement('canvas');
    },
    async destroy() {},
  };
}

function view(doc: PdfDoc, position: TurnPosition) {
  return <PageView doc={doc} position={position} paper="ivory" crop={false} dividerRatio={0.5} />;
}

describe('PageView render failure (F3)', () => {
  it('shows a Ukrainian error for the requested page, not the previous page, and retry renders again', async () => {
    const broken = new Set<number>([2]);
    const doc = fakeDoc(broken);
    const { rerender } = render(view(doc, { page: 1, half: false }));
    await waitFor(() => expect(screen.getAllByTestId('pv-layer')[0]?.getAttribute('data-page')).toBe('1'));

    rerender(view(doc, { page: 2, half: false }));
    await waitFor(() => expect(screen.getByTestId('pv-error').textContent).toContain('Не вдалося показати сторінку 2'));
    // The old page 1 must not stay on screen under a position that says page 2.
    expect(screen.queryAllByTestId('pv-layer')).toHaveLength(0);
    expect(screen.getByTestId('pv-retry').textContent).toBe('Спробувати ще раз');

    broken.delete(2);
    fireEvent.click(screen.getByTestId('pv-retry'));
    await waitFor(() => expect(screen.getAllByTestId('pv-layer')[0]?.getAttribute('data-page')).toBe('2'));
    expect(screen.queryByTestId('pv-error')).toBeNull();
  });

  it('shows the error instead of a spinner when the first page fails', async () => {
    const doc = fakeDoc(new Set([1]));
    render(view(doc, { page: 1, half: false }));
    await waitFor(() => expect(screen.getByTestId('pv-error').textContent).toContain('сторінку 1'));
  });

  it('turning to a good page clears the error', async () => {
    const doc = fakeDoc(new Set([2]));
    const { rerender } = render(view(doc, { page: 2, half: false }));
    await waitFor(() => expect(screen.getByTestId('pv-error')).toBeTruthy());
    rerender(view(doc, { page: 3, half: false }));
    await waitFor(() => expect(screen.getAllByTestId('pv-layer')[0]?.getAttribute('data-page')).toBe('3'));
    expect(screen.queryByTestId('pv-error')).toBeNull();
  });
});

/** A pointer-like event with fixed fields (happy-dom may lack PointerEvent). */
function pe(type: string, target: EventTarget, x: number, y: number, t: number): Event {
  const e = new Event(type, { bubbles: true, cancelable: true });
  const fields = { pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, timeStamp: t };
  for (const [k, v] of Object.entries(fields)) Object.defineProperty(e, k, { value: v });
  Object.defineProperty(e, 'target', { value: target });
  return e;
}

function gesture(target: Element, from: [number, number], to: [number, number]): void {
  target.dispatchEvent(pe('pointerdown', target, from[0], from[1], 0));
  target.dispatchEvent(pe('pointerup', target, to[0], to[1], 80));
}

describe('PageView error panel and navigation (F6)', () => {
  it('edge taps, centre tap and swipes on the panel navigate; the retry button does not', async () => {
    const doc = fakeDoc(new Set([1]));
    const { container } = render(view(doc, { page: 1, half: false }));
    const wrap = container.firstElementChild as HTMLElement;
    wrap.getBoundingClientRect = () => ({ left: 0, top: 0, right: 600, bottom: 800, width: 600, height: 800, x: 0, y: 0, toJSON() {} });
    const actions: NavAction[] = [];
    const off = attachPointerNav(wrap, (a) => actions.push(a));
    await waitFor(() => expect(screen.getByTestId('pv-error')).toBeTruthy());
    const panel = screen.getByTestId('pv-error');

    gesture(panel, [50, 400], [50, 400]);
    gesture(panel, [550, 400], [550, 400]);
    gesture(panel, [300, 700], [300, 700]);
    gesture(panel, [400, 400], [300, 400]);
    gesture(panel, [300, 400], [400, 400]);
    expect(actions).toEqual(['prev', 'next', 'menu', 'next', 'prev']);

    actions.length = 0;
    const retry = screen.getByTestId('pv-retry');
    gesture(retry, [50, 400], [50, 400]);
    gesture(retry, [300, 400], [300, 400]);
    expect(actions).toEqual([]);
    off();
  });
});

describe('PageView pending retry (F3)', () => {
  it('shows the spinner, not the old page, while a retry is pending; a normal turn keeps the old page', async () => {
    const broken = new Set<number>([2]);
    let hold: Promise<void> | null = null;
    let release: () => void = () => {};
    const base = fakeDoc(broken);
    const doc: PdfDoc = {
      ...base,
      async renderPage(page, opts) {
        if (hold && page === 2) await hold;
        return base.renderPage(page, opts);
      },
    };
    const { rerender } = render(view(doc, { page: 1, half: false }));
    await waitFor(() => expect(screen.getAllByTestId('pv-layer')[0]?.getAttribute('data-page')).toBe('1'));

    // Normal turn to a page that is slow: the old page stays until the new one is ready.
    broken.clear();
    hold = new Promise<void>((r) => (release = r));
    rerender(view(doc, { page: 3, half: false }));
    rerender(view(doc, { page: 2, half: false }));
    expect(screen.getAllByTestId('pv-layer')[0]?.getAttribute('data-page')).toBe('1');
    release();
    await waitFor(() => expect(screen.getAllByTestId('pv-layer')[0]?.getAttribute('data-page')).toBe('2'));

    // Fail page 4, then retry with a held render.
    broken.add(4);
    rerender(view(doc, { page: 4, half: false }));
    await waitFor(() => expect(screen.getByTestId('pv-error')).toBeTruthy());
    expect(screen.queryAllByTestId('pv-layer')).toHaveLength(0);
    broken.delete(4);
    let release4: () => void = () => {};
    const gate = new Promise<void>((r) => (release4 = r));
    const base4 = doc.renderPage.bind(doc);
    doc.renderPage = async (page, opts) => {
      if (page === 4) await gate;
      return base4(page, opts);
    };
    fireEvent.click(screen.getByTestId('pv-retry'));
    await waitFor(() => expect(screen.queryByTestId('pv-error')).toBeNull());
    expect(screen.queryAllByTestId('pv-layer')).toHaveLength(0);
    expect(document.querySelector('.pv-loading')).toBeTruthy();
    release4();
    await waitFor(() => expect(screen.getAllByTestId('pv-layer')[0]?.getAttribute('data-page')).toBe('4'));
  });
});
