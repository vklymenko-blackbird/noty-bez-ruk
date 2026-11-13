import type { PaperTheme, PenColor } from '../contracts';

export const PAPER_THEMES: PaperTheme[] = ['ivory', 'sepia', 'night', 'contrast', 'plain'];

/** STUB: replaced by package paper-crop. */
export function paperClass(theme: PaperTheme): string {
  return 'paper paper-' + theme;
}

/** STUB: replaced by package paper-crop. */
export function inkPalette(theme: PaperTheme): Record<PenColor, string> {
  const ink = theme === 'night' ? '#E8E1D3' : '#1F1B16';
  return { ink, burgundy: '#8C2F39', blue: '#2E5A88', highlight: 'rgba(244,208,63,.40)' };
}
