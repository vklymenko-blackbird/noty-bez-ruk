import type { WakeKeeper } from '../contracts';

/** STUB: replaced by package play-logic. acquire() resolves 'none'. */
export function createWakeKeeper(): WakeKeeper {
  return {
    async acquire() {
      return 'none';
    },
    release() {},
  };
}
