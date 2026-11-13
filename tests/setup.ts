import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/preact';
import { afterEach, beforeEach } from 'vitest';
import { settings } from '../src/settings';
import { storage } from '../src/storage';

afterEach(() => cleanup());

beforeEach(async () => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  settings.reset();
  try {
    for (const s of await storage.listScores()) await storage.deleteScore(s.id);
  } catch {
    /* ignore */
  }
});
