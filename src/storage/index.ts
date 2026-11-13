import { createIdbStorage } from './idb';

export { createMemoryStorage } from './memory';
export { runStorageContract } from './contractSuite';
export { createIdbStorage } from './idb';
export const storage = createIdbStorage();
