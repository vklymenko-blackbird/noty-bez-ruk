// Generates pose traces. SPEC section 1.6 is the source of truth for the gesture rules;
// the traces only describe input samples and the turns that section 1.6 must produce.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'tests/traces');
mkdirSync(out, { recursive: true });

const r2 = (n) => Math.round(n * 100) / 100;
const face = (yaw, ml = 0.02, mr = 0.02) => ({ facePresent: true, yawDeg: yaw, mouthLeft: ml, mouthRight: mr });
const noFace = () => ({ facePresent: false, yawDeg: 0, mouthLeft: 0, mouthRight: 0 });
const rep = (v, n) => Array.from({ length: n }, () => v);
const yaws = (list) => list.map((y) => face(y));
const CAL = () => rep(face(4), 25);

function build(name, kind, note, parts, expectTurns, expectEvents) {
  const samples = parts.flat().map((s, i) => ({ t: i * 100, ...s, yawDeg: r2(s.yawDeg) }));
  writeFileSync(join(out, `${name}.json`), JSON.stringify({ name, kind, note, samples, expectTurns, expectEvents }) + '\n');
  return name;
}

const names = [];
const T = (...a) => names.push(build(...a));

T('turn-right-hold', 'head', 'Head turns right, holds, returns. One next.',
  [CAL(), yaws([14, 24, 34]), yaws(rep(34, 10)), yaws([24, 14]), yaws(rep(4, 15))], ['next'], ['calibrated', 'turn:next']);
T('turn-left-hold', 'head', 'Head turns left, holds, returns. One prev.',
  [CAL(), yaws([-6, -16, -26]), yaws(rep(-26, 10)), yaws([-16, -6]), yaws(rep(4, 15))], ['prev'], ['calibrated', 'turn:prev']);
T('glance-short', 'head', 'A glance shorter than the hold time. No turn.',
  [CAL(), yaws([14, 24, 34, 34, 14]), yaws(rep(4, 15))], [], ['calibrated']);
T('hold-long', 'head', 'A very long hold gives exactly one turn.',
  [CAL(), yaws([14, 24]), yaws(rep(34, 60)), yaws([24, 14]), yaws(rep(4, 15))], ['next'], ['calibrated', 'turn:next']);
T('double-turn', 'head', 'Two clean turns with a neutral gap longer than the cooldown.',
  [CAL(), yaws([14, 24]), yaws(rep(34, 8)), yaws([14]), yaws(rep(4, 25)), yaws([14, 24]), yaws(rep(34, 8)), yaws([14]), yaws(rep(4, 15))],
  ['next', 'next'], ['calibrated', 'turn:next', 'turn:next']);
T('too-soon', 'head', 'The second turn comes inside the cooldown. Only one turn.',
  [CAL(), yaws([14, 24]), yaws(rep(34, 8)), yaws([14]), yaws(rep(4, 4)), yaws([14, 24]), yaws(rep(34, 6)), yaws([14]), yaws(rep(4, 20))],
  ['next'], ['calibrated', 'turn:next']);
T('nod-noise', 'head', 'Rhythmic sway below the threshold. No turn.',
  [CAL(), Array.from({ length: 80 }, (_, i) => face(4 + 6 * Math.sin((2 * Math.PI * i) / 7)))], [], ['calibrated']);
T('face-lost-mid-hold', 'head', 'The face is lost during arming. No turn.',
  [CAL(), yaws([14, 24, 34, 34]), rep(noFace(), 10), yaws(rep(4, 15))], [], ['calibrated', 'face:false', 'face:true']);
T('face-returns-turned', 'head', 'The face returns already turned. It must be neutral for 200 ms first. No turn.',
  [CAL(), yaws(rep(4, 5)), rep(noFace(), 10), yaws(rep(34, 15)), yaws(rep(4, 15))], [], ['calibrated', 'face:false', 'face:true']);
T('mouth-right-hold', 'mouth', 'Mouth pulled to the right, held. One next.',
  [CAL(), rep(face(4, 0.05, 0.7), 9), rep(face(4), 15)], ['next'], ['calibrated', 'turn:next']);
T('mouth-left-hold', 'mouth', 'Mouth pulled to the left, held. One prev.',
  [CAL(), rep(face(4, 0.7, 0.05), 9), rep(face(4), 15)], ['prev'], ['calibrated', 'turn:prev']);
T('mouth-smile', 'mouth', 'A smile moves both sides. No turn.',
  [CAL(), rep(face(4, 0.6, 0.6), 10), rep(face(4), 15)], [], ['calibrated']);
T('calibration-no-face', 'head', 'No face during the first calibration, then a good one, then a turn.',
  [rep(noFace(), 25), rep(face(4), 25), yaws([14, 24]), yaws(rep(34, 8)), yaws([14]), yaws(rep(4, 10))],
  ['next'], ['calibration-failed', 'calibrated', 'turn:next']);
T('slow-drift', 'head', 'Yaw rises slowly from 4 to 12 over 30 s. No turn.',
  [CAL(), Array.from({ length: 300 }, (_, i) => face(4 + (8 * i) / 299))], [], ['calibrated']);

writeFileSync(join(out, 'index.json'), JSON.stringify(names, null, 2) + '\n');
console.log(`traces: wrote ${names.length} traces`);
