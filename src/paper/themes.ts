import type { PaperTheme, PenColor } from '../contracts';
import './paper.css';

export const PAPER_THEMES: PaperTheme[] = ['ivory', 'sepia', 'night', 'contrast', 'plain'];

/** CSS class for the page box. The canvas inside gets the theme filter. */
export function paperClass(theme: PaperTheme): string {
  return 'paper paper-' + theme;
}

/**
 * Pen colours for the annotation overlay, as CSS colour strings.
 * Canvas 2D needs real colour values, so these literals mirror the pen tokens.
 */
export function inkPalette(theme: PaperTheme): Record<PenColor, string> {
  if (theme === 'night') {
    return {
      ink: '#E8E1D3',
      burgundy: '#D9737B',
      blue: '#7FA8D6',
      highlight: 'rgba(244,208,63,0.35)',
    };
  }
  return {
    ink: '#1F1B16',
    burgundy: '#8C2F39',
    blue: '#2E5A88',
    highlight: 'rgba(244,208,63,0.40)',
  };
}
