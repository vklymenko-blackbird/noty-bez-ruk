import { describe, expect, it } from 'vitest';
import { t } from './index';

describe('t()', () => {
  it('returns plain text', () => {
    expect(t('library.title')).toBe('Мої ноти');
  });
  it('replaces placeholders', () => {
    expect(t('common.pageOf', { page: 3, count: 12 })).toBe('стор. 3 з 12');
  });
  it('keeps unknown placeholders', () => {
    expect(t('common.pageOf', { page: 3 })).toBe('стор. 3 з {count}');
  });
});
