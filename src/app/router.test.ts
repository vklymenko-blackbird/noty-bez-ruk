import { describe, expect, it } from 'vitest';
import { matchRoute } from './router';

describe('matchRoute', () => {
  it('matches the root', () => {
    expect(matchRoute('/', '/')).toEqual({});
  });
  it('extracts params', () => {
    expect(matchRoute('/score/:id', '/score/abc%20d')).toEqual({ id: 'abc d' });
    expect(matchRoute('/dev/:what/:id', '/dev/pageview/x')).toEqual({ what: 'pageview', id: 'x' });
  });
  it('rejects other shapes', () => {
    expect(matchRoute('/score/:id', '/score')).toBeNull();
    expect(matchRoute('/search', '/settings')).toBeNull();
  });
});
