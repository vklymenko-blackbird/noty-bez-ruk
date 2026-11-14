import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, fireEvent, screen, waitFor, cleanup } from '@testing-library/preact';
import type { PdfDoc, TurnPosition } from '../contracts';
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
