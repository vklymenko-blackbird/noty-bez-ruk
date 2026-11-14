import { describe, it, expect } from 'vitest';
import { PAPER_THEMES, paperClass, inkPalette } from './themes';

describe('PAPER_THEMES', () => {
  it('lists the five themes in order', () => {
    expect(PAPER_THEMES).toEqual(['ivory', 'sepia', 'night', 'contrast', 'plain']);
  });
});

describe('paperClass', () => {
  it('returns the page box class for each theme', () => {
    expect(paperClass('ivory')).toBe('paper paper-ivory');
    expect(paperClass('night')).toBe('paper paper-night');
    expect(paperClass('plain')).toBe('paper paper-plain');
  });
});

describe('inkPalette', () => {
  it('uses the ivory pen colours', () => {
    expect(inkPalette('ivory')).toEqual({
      ink: '#1F1B16',
      burgundy: '#8C2F39',
      blue: '#2E5A88',
      highlight: 'rgba(244,208,63,0.40)',
    });
  });

  it('uses the night pen colours', () => {
    expect(inkPalette('night')).toEqual({
      ink: '#E8E1D3',
      burgundy: '#D9737B',
      blue: '#7FA8D6',
      highlight: 'rgba(244,208,63,0.35)',
    });
  });
});
