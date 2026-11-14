import { createMemoryStorage } from './memory';
import { runStorageContract } from './contractSuite';

runStorageContract('memory', () => createMemoryStorage());
