// One-time download of the MediaPipe face landmarker model. The result is committed.
import { mkdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_ = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const EXPECTED = 3_758_596;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/mediapipe/face_landmarker.task');

if (existsSync(out) && statSync(out).size === EXPECTED) {
  console.log('fetch-model: already present');
  process.exit(0);
}
const res = await fetch(URL_);
if (!res.ok) throw new Error(`fetch-model: HTTP ${res.status}`);
const buf = Buffer.from(await res.arrayBuffer());
if (buf.length !== EXPECTED) throw new Error(`fetch-model: wrong size ${buf.length}, expected ${EXPECTED}`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buf);
console.log(`fetch-model: wrote ${out} (${buf.length} bytes)`);
