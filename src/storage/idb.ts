import type { StorageApi } from '../contracts';
import { createMemoryStorage } from './memory';

/** STUB: replaced by package storage-idb. */
export function createIdbStorage(_dbName?: string): StorageApi {
  return createMemoryStorage();
}
