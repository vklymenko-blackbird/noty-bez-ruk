import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import LibraryScreen from './LibraryScreen';
import { storage } from '../storage';
import { settings } from '../settings';
import type { ScoreOrigin } from '../contracts';

const origin: ScoreOrigin = { kind: 'file', sourceName: 'Файл', license: null, pageUrl: null, fileUrl: null };

async function add(title: string, composer: string, pageCount: number, lastOpenedAt = 0) {
  const meta = await storage.addScore({ title, composer, pageCount, origin }, new ArrayBuffer(8));
  const patch: { lastOpenedAt?: number } = {};
  if (lastOpenedAt > 0) patch.lastOpenedAt = lastOpenedAt;
  if (Object.keys(patch).length > 0) await storage.updateScore(meta.id, patch);
  return meta;
}

function renderScreen() {
  return render(<LibraryScreen params={{}} />);
}

describe('LibraryScreen', () => {
  beforeEach(() => {
    vi.spyOn(storage, 'estimate').mockResolvedValue({ usageBytes: null, quotaBytes: null, persisted: true, volatile: false });
  });

  it('shows the empty state with its two buttons', async () => {
    renderScreen();
    expect(await screen.findByTestId('library-empty')).toBeTruthy();
    expect(screen.getByText('Додайте перші ноти')).toBeTruthy();
    expect(screen.getByTestId('btn-find')).toBeTruthy();
    expect(screen.getByTestId('btn-open-pdf')).toBeTruthy();
    expect(screen.queryByTestId('library-grid')).toBeNull();
  });

  it('shows the install banner outside the Home Screen app', async () => {
    renderScreen();
    expect(await screen.findByTestId('library-install')).toBeTruthy();
  });

  it('renders two cards in the chosen sort order', async () => {
    await add('Zeta', 'Chopin', 4);
    await add('Alpha', 'Bach', 12);
    settings.set({ librarySort: 'title' });
    renderScreen();
    await waitFor(() => expect(screen.getAllByTestId('score-card')).toHaveLength(2));
    const titles = screen.getAllByTestId('score-card').map((el) => el.textContent ?? '');
    expect(titles[0]).toContain('Alpha');
    expect(titles[1]).toContain('Zeta');
    expect(screen.getByText('стор. 1 з 12', { exact: false })).toBeTruthy();
  });

  it('puts the continue ribbon on the most recently opened score', async () => {
    await add('Older', 'Bach', 3, 1000);
    await add('Newer', 'Chopin', 3, 5000);
    await add('Never', 'Liszt', 3, 0);
    renderScreen();
    const ribbon = await screen.findByTestId('continue-ribbon');
    const card = ribbon.closest('[data-testid="score-card"]');
    expect(card?.textContent).toContain('Newer');
    expect(screen.getAllByTestId('continue-ribbon')).toHaveLength(1);
  });

  it('navigates to the score when a card is tapped', async () => {
    const meta = await add('Tap me', 'Bach', 2);
    renderScreen();
    const card = await screen.findByTestId('score-card');
    expect(card.getAttribute('data-id')).toBe(meta.id);
    fireEvent.click(card);
    expect(location.hash).toBe('#/score/' + meta.id);
  });

  it('shows the volatile warning when storage is only in memory', async () => {
    vi.spyOn(storage, 'estimate').mockResolvedValue({ usageBytes: null, quotaBytes: null, persisted: false, volatile: true });
    renderScreen();
    expect(await screen.findByTestId('library-volatile')).toBeTruthy();
  });
});
