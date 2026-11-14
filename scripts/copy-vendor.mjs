// Copies vendored runtime assets into public/. Idempotent, no network.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jobs = [
  ['node_modules/@mediapipe/tasks-vision/wasm', 'public/mediapipe/wasm'],
  ['node_modules/pdfjs-dist/cmaps', 'public/pdfjs/cmaps'],
  ['node_modules/pdfjs-dist/standard_fonts', 'public/pdfjs/standard_fonts'],
  ['node_modules/pdfjs-dist/wasm', 'public/pdfjs/wasm'],
];
const SKIP = ['quickjs-eval', 'LICENSE_QUICKJS', 'LICENSE_PDFJS_QUICKJS'];
const isSkipped = (name) => SKIP.some((p) => name.startsWith(p));
for (const [from, to] of jobs) {
  const src = join(root, from);
  if (!existsSync(src)) {
    console.log(`copy-vendor: skip ${from} (not found)`);
    continue;
  }
  mkdirSync(join(root, to), { recursive: true });
  cpSync(src, join(root, to), { recursive: true, filter: (s) => !isSkipped(basename(s)) });
}
const wasmOut = join(root, 'public/pdfjs/wasm');
if (existsSync(wasmOut)) {
  for (const name of readdirSync(wasmOut)) {
    if (isSkipped(name)) rmSync(join(wasmOut, name), { force: true });
  }
}
console.log('copy-vendor: done');
