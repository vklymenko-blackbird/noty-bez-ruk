import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import ScoreScreen from './ScoreScreen';
import { storage } from '../storage';
import { AppError } from '../contracts';

// The PDF engine is not part of these unit tests: opening always fails.
vi.mock('../pdf', () => ({
  openPdf: vi.fn(() => Promise.reject(new AppError('pdf-open-failed'))),
}));

async function seed(lastPage = 1): Promise<string> {
  const meta = await storage.addScore(
    {
      title: 'Für Elise',
      composer: 'Ludwig van Beethoven',
      detail: 'WoO 59',
      pageCount: 3,
      origin: { kind: 'file', sourceName: 'Файл', license: null, pageUrl: null, fileUrl: null },
    },
    new ArrayBuffer(8),
  );
  if (lastPage !== 1) await storage.updateScore(meta.id, { lastPage });
  return meta.id;
}

describe('ScoreScreen', () => {
  beforeEach(() => {
    window.location.hash = '#/';
  });

  it('renders the title and the composer', async () => {
    const id = await seed();
    render(<ScoreScreen params={{ id }} />);
    expect((await screen.findByTestId('score-title')).textContent).toBe('Für Elise');
    expect(screen.getByText('Ludwig van Beethoven')).toBeTruthy();
  });

  it('shows the plain play button when the score starts at page 1', async () => {
    const id = await seed(1);
    render(<ScoreScreen params={{ id }} />);
    const btn = await screen.findByTestId('btn-play');
    expect(btn.textContent).toBe('Грати');
    expect(screen.queryByTestId('btn-from-start')).toBeNull();
  });

  it('offers to continue from the saved page', async () => {
    const id = await seed(5);
    render(<ScoreScreen params={{ id }} />);
    const btn = await screen.findByTestId('btn-play');
    expect(btn.textContent).toBe('Продовжити зі стор. 5');
    expect(screen.getByTestId('btn-from-start')).toBeTruthy();
  });

  it('a paper chip tap saves the paper theme', async () => {
    const id = await seed();
    render(<ScoreScreen params={{ id }} />);
    fireEvent.click(await screen.findByTestId('paper-chip-night'));
    await waitFor(async () => {
      expect((await storage.getScore(id))?.paper).toBe('night');
    });
  });

  it('the crop switch saves the crop flag', async () => {
    const id = await seed();
    render(<ScoreScreen params={{ id }} />);
    const sw = (await screen.findByTestId('switch-crop')) as HTMLInputElement;
    fireEvent.click(sw);
    await waitFor(async () => {
      expect((await storage.getScore(id))?.crop).toBe(false);
    });
  });

  it('rename keeps a non-empty title and ignores an empty one', async () => {
    const id = await seed();
    render(<ScoreScreen params={{ id }} />);
    fireEvent.click(await screen.findByTestId('btn-more'));
    fireEvent.click(await screen.findByTestId('btn-rename'));
    const title = (await screen.findByTestId('rename-title')) as HTMLInputElement;
    fireEvent.input(title, { target: { value: '   ' } });
    expect((screen.getByTestId('rename-save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.input(title, { target: { value: 'Bagatelle' } });
    fireEvent.click(screen.getByTestId('rename-save'));
    await waitFor(async () => {
      expect((await storage.getScore(id))?.title).toBe('Bagatelle');
    });
  });

  it('delete removes the score and goes to the library', async () => {
    const id = await seed();
    render(<ScoreScreen params={{ id }} />);
    fireEvent.click(await screen.findByTestId('btn-more'));
    fireEvent.click(await screen.findByTestId('btn-delete'));
    fireEvent.click(await screen.findByTestId('confirm-ok'));
    await waitFor(async () => {
      expect(await storage.getScore(id)).toBeNull();
    });
    expect(window.location.hash).toBe('#/');
  });

  it('an unknown id goes back to the library', async () => {
    const spy = vi.fn();
    window.addEventListener('hashchange', spy);
    render(<ScoreScreen params={{ id: 'missing-id' }} />);
    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });
    window.removeEventListener('hashchange', spy);
  });
});
