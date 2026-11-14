import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import type { PdfDoc } from '../contracts';
import PlayScreen from './PlayScreen';
import { storage } from '../storage';
import { settings } from '../settings';

// The PDF engine is replaced by a small fake document; the page cache stays real.
vi.mock('../pdf', async () => {
  const actual = await vi.importActual<typeof import('../pdf')>('../pdf');
  const doc: PdfDoc = {
    pageCount: 3,
    async getPageSize() {
      return { width: 600, height: 800 };
    },
    async renderPage() {
      return document.createElement('canvas');
    },
    async destroy() {},
  };
  return { ...actual, openPdf: vi.fn(async () => doc) };
});

beforeEach(() => {
  // happy-dom has no layout: give every element a size so the page view starts to render.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 600 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 800 });
  window.location.hash = '#/';
});

afterEach(() => {
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
});

async function seed(): Promise<string> {
  const meta = await storage.addScore(
    {
      title: 'Тест',
      composer: 'Автор',
      detail: '',
      pageCount: 3,
      origin: { kind: 'file', sourceName: 'Файл', license: null, pageUrl: null, fileUrl: null },
    },
    new ArrayBuffer(8),
  );
  return meta.id;
}

function topOf(el: HTMLElement): number {
  return parseFloat(el.style.top);
}

describe('PlayScreen half-page divider (F4)', () => {
  it('keeps the dragged divider position after the drag ends and saves it', async () => {
    settings.set({ halfPage: true, gesture: 'off' });
    const id = await seed();
    render(<PlayScreen params={{ id }} />);
    await screen.findByTestId('pv');
    await waitFor(() => expect(screen.getAllByTestId('pv-layer').length).toBe(1));

    // Next key: with the half page on, the first turn shows the second half.
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    const divider = await screen.findByTestId('pv-divider');
    const startTop = topOf(divider);
    expect(startTop).toBeCloseTo(400, 0); // ratio 0.5 of an 800 px page

    const notch = screen.getByTestId('pv-notch');
    fireEvent.pointerDown(notch, { clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(notch, { clientY: 480, pointerId: 1 });
    fireEvent.pointerUp(notch, { clientY: 480, pointerId: 1 });

    // The new ratio is 0.6: 480 px. It must not snap back to 400 px.
    await waitFor(() => expect(topOf(screen.getByTestId('pv-divider'))).toBeCloseTo(480, 0));
    await waitFor(async () => expect((await storage.getScore(id))?.dividerRatio).toBeCloseTo(0.6, 2));
  });
});
