import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/preact';
import Cover, { tintIndex, titleLengthStep } from './Cover';

function tintClass(container: Element): string {
  const root = container.querySelector<HTMLElement>('[data-testid="cover"]');
  if (!root) throw new Error('cover root not found');
  return [...root.classList].find((c) => c.startsWith('cover--tint-')) ?? '';
}

describe('Cover', () => {
  it('renders the title, the composer surname and the detail', () => {
    render(<Cover title="Für Elise" composer="Ludwig van Beethoven" detail="WoO 59" />);
    expect(screen.getByText('Für Elise')).toBeTruthy();
    expect(screen.getByText('Beethoven')).toBeTruthy();
    expect(screen.getByText('WoO 59')).toBeTruthy();
  });

  it('gives the same composer the same tint', () => {
    const one = render(<Cover title="A" composer="Chopin" />);
    const first = tintClass(one.container);
    one.unmount();
    const two = render(<Cover title="B" composer="Chopin" />);
    expect(tintClass(two.container)).toBe(first);
    expect(first).toMatch(/^cover--tint-[0-5]$/);
  });

  it('computes the tint from the char code sum modulo 6', () => {
    expect(tintIndex('')).toBe(0);
    expect(tintIndex('ab')).toBe((97 + 98) % 6);
  });

  it('shows no surname when there is no composer', () => {
    const { container } = render(<Cover title="Anonymous Piece" composer="" />);
    expect(container.querySelector('.cover__surname')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('has an aria-label with the title and the composer', () => {
    render(<Cover title="Für Elise" composer="Ludwig van Beethoven" />);
    expect(screen.getByRole('img', { name: 'Für Elise, Ludwig van Beethoven' })).toBeTruthy();
  });

  it('uses only the title as aria-label when there is no composer', () => {
    render(<Cover title="Anonymous Piece" composer="" />);
    expect(screen.getByRole('img', { name: 'Anonymous Piece' })).toBeTruthy();
  });

  it('passes the class prop to the root element', () => {
    render(<Cover title="T" composer="X" size="lg" class="cover--fluid extra-class" />);
    const root = screen.getByTestId('cover');
    expect(root.classList.contains('cover--fluid')).toBe(true);
    expect(root.classList.contains('extra-class')).toBe(true);
    expect(root.classList.contains('cover--lg')).toBe(true);
  });

  it('steps the title font down for long titles', () => {
    expect(titleLengthStep('Für Elise')).toBe(0);
    expect(titleLengthStep('Ноктюрн ре-бемоль мажор, ор. 27 № 2 і ще')).toBe(1);
    expect(titleLengthStep('Соната для фортепіано № 14 до-дієз мінор «Місячна», ор. 27 № 2: I. Adagio sostenuto')).toBe(2);
    const { container } = render(<Cover title={'Дуже довга назва твору '.repeat(5)} composer="Автор" />);
    expect(container.querySelector('[data-testid="cover"]')?.classList.contains('cover--len-2')).toBe(true);
  });
});
