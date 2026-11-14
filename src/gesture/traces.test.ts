import { describe, expect, it } from 'vitest';
import type { GestureEvent, GestureKind, PoseSample } from '../contracts';
import { DEFAULT_SETTINGS } from '../contracts';
import { configFromSettings, createGestureEngine } from './engine';

interface Trace {
  name: string;
  kind: GestureKind;
  note?: string;
  samples: PoseSample[];
  expectTurns: string[];
  expectEvents: string[];
}

const modules = import.meta.glob('../../tests/traces/*.json', { eager: true, import: 'default' });

const traces: Trace[] = Object.entries(modules)
  .filter(([path]) => !path.endsWith('/index.json'))
  .map(([, value]) => value as Trace)
  .sort((a, b) => a.name.localeCompare(b.name));

/** Maps engine events to the trace vocabulary: turn:next, calibrated, face:false, ... */
function toLabel(e: GestureEvent): string {
  switch (e.type) {
    case 'turn':
      return `turn:${e.dir}`;
    case 'face':
      return `face:${e.present}`;
    default:
      return e.type;
  }
}

describe('pose traces (SPEC 1.6 is the source of truth)', () => {
  it('finds all 14 traces', () => {
    expect(traces).toHaveLength(14);
  });

  for (const trace of traces) {
    it(trace.name, () => {
      const engine = createGestureEngine(configFromSettings({ ...DEFAULT_SETTINGS, gesture: trace.kind }));
      engine.calibrate();
      const events: GestureEvent[] = [];
      for (const s of trace.samples) events.push(...engine.push(s));
      const turns = events.flatMap((e) => (e.type === 'turn' ? [e.dir] : []));
      expect(turns, `turn list of ${trace.name}`).toEqual(trace.expectTurns);
      expect(events.map(toLabel), `event list of ${trace.name}`).toEqual(trace.expectEvents);
    });
  }
});
