import type { GestureController, GestureControllerDeps, GestureSnapshot } from '../contracts';
import { createGestureEngine, configFromSettings } from './engine';

/** STUB: replaced by package gesture-engine. Inert; the status stays idle. */
export function createGestureController(deps: GestureControllerDeps): GestureController {
  const engine = createGestureEngine(configFromSettings(deps.getSettings()));
  const subs = new Set<() => void>();
  const snapshot = (): GestureSnapshot => ({ status: 'idle', state: engine.getState() });
  return {
    async start() {},
    stop() {},
    recalibrate() {},
    setPaused(paused) {
      engine.setPaused(paused);
    },
    getSnapshot: snapshot,
    subscribe(cb) {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    getVideoStream: () => null,
  };
}
