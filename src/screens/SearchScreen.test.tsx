import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import type { ScoreHit } from '../contracts';
import { AppError } from '../contracts';

const hit = (over: Partial<ScoreHit>): ScoreHit => ({
  id: 'x',
  source: 'catalog',
  title: 'Für Elise',
  composer: 'Ludwig van Beethoven',
  detail: 'WoO 59',
  license: 'Public domain',
  pageUrl: 'https://commons.wikimedia.org/wiki/File:Elise.pdf',
  fileUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Elise.pdf',
  sizeBytes: 427090,
  pages: null,
  ...over,
});

const mocks = vi.hoisted(() => ({
  searchCatalog: vi.fn(),
  popularCatalog: vi.fn(),
  searchCommons: vi.fn(),
  downloadScore: vi.fn(),
  linkOuts: vi.fn(),
}));

vi.mock('../sources', () => mocks);

import SearchScreen from './SearchScreen';

describe('SearchScreen', () => {
  beforeEach(() => {
    window.location.hash = '#/search';
    mocks.popularCatalog.mockReturnValue([hit({ id: 'pop', title: 'Популярний твір' })]);
    mocks.searchCatalog.mockReturnValue([]);
    mocks.searchCommons.mockResolvedValue([]);
    mocks.linkOuts.mockImplementation((q: string) => [
      { id: 'imslp', label: 'Шукати на IMSLP', url: `https://imslp.org/index.php?search=${q}` },
      { id: 'commons', label: 'Шукати на Wikimedia Commons', url: `https://commons.wikimedia.org/w/index.php?search=${q}` },
    ]);
  });

  it('shows the popular list and the note on an empty query', () => {
    render(<SearchScreen params={{}} />);
    expect(screen.getByText('Популярне')).toBeTruthy();
    expect(screen.getByText('Популярний твір')).toBeTruthy();
    expect(screen.getByTestId('search-note')).toBeTruthy();
  });

  it('shows catalogue hits at once when the user types', async () => {
    mocks.searchCatalog.mockReturnValue([hit({ id: 'e1' })]);
    render(<SearchScreen params={{}} />);
    fireEvent.input(screen.getByTestId('search-input'), { target: { value: 'Elise' } });
    expect(await screen.findByText('З каталогу')).toBeTruthy();
    expect(screen.getAllByTestId('hit-card')).toHaveLength(1);
    expect(screen.getByTestId('hit-card').getAttribute('data-source')).toBe('catalog');
    expect(screen.getByTestId('hit-add').textContent).toContain('Додати');
  });

  it('shows the licence on every card', async () => {
    mocks.searchCatalog.mockReturnValue([hit({ id: 'a' }), hit({ id: 'b', license: 'CC0' })]);
    render(<SearchScreen params={{}} />);
    fireEvent.input(screen.getByTestId('search-input'), { target: { value: 'Elise' } });
    const badges = await screen.findAllByTestId('hit-license');
    expect(badges.map((b) => b.textContent)).toEqual(['Ліцензія: Public domain', 'Ліцензія: CC0']);
  });

  it('has no add button when the hit has no file', async () => {
    mocks.searchCatalog.mockReturnValue([hit({ id: 'n', fileUrl: null })]);
    render(<SearchScreen params={{}} />);
    fireEvent.input(screen.getByTestId('search-input'), { target: { value: 'Elise' } });
    const action = await screen.findByTestId('hit-add');
    expect(action.tagName).not.toBe('BUTTON');
    expect(action.textContent).toBe('Лише на сайті джерела');
  });

  it('shows the offline message and keeps the catalogue section', async () => {
    mocks.searchCatalog.mockReturnValue([hit({ id: 'e1' })]);
    mocks.searchCommons.mockRejectedValue(new AppError('offline'));
    render(<SearchScreen params={{}} />);
    fireEvent.input(screen.getByTestId('search-input'), { target: { value: 'Elise' } });
    await waitFor(() => expect(screen.getByTestId('search-offline')).toBeTruthy());
    expect(screen.getByText('З каталогу')).toBeTruthy();
  });

  it('removes Commons hits that are already in the catalogue hits', async () => {
    mocks.searchCatalog.mockReturnValue([hit({ id: 'e1' })]);
    mocks.searchCommons.mockResolvedValue([hit({ id: 'c1', source: 'commons', title: 'Duplicate' }), hit({ id: 'c2', source: 'commons', title: 'Other', fileUrl: 'https://upload.wikimedia.org/other.pdf' })]);
    render(<SearchScreen params={{}} />);
    fireEvent.input(screen.getByTestId('search-input'), { target: { value: 'Elise' } });
    await screen.findByText('Other');
    expect(screen.queryByText('Duplicate')).toBeNull();
  });

  it('shows the empty text when nothing is found', async () => {
    render(<SearchScreen params={{}} />);
    fireEvent.input(screen.getByTestId('search-input'), { target: { value: 'zzzz' } });
    expect(await screen.findByTestId('search-empty')).toBeTruthy();
  });

  it('renders no link for an unsafe page URL', async () => {
    mocks.searchCatalog.mockReturnValue([hit({ id: 'u', pageUrl: 'http://evil.example/x' })]);
    render(<SearchScreen params={{}} />);
    fireEvent.input(screen.getByTestId('search-input'), { target: { value: 'Elise' } });
    await screen.findByTestId('hit-card');
    expect(screen.queryByText('Відкрити джерело')).toBeNull();
  });

  it('renders the link-outs with safe attributes', () => {
    render(<SearchScreen params={{}} />);
    const a = screen.getByTestId('linkout-imslp');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
