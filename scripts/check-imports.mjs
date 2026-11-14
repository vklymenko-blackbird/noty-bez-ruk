// Checks that every relative import in src matches a tracked file with exact letter case.
// The Mac ignores case; the Linux build server does not.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, posix } from 'node:path';

const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);
const set = new Set(tracked);
const lower = new Map(tracked.map((f) => [f.toLowerCase(), f]));
const EXT = ['', '.ts', '.tsx', '.js', '.mjs', '.css', '/index.ts', '/index.tsx', '/index.js'];
const re = /(?:import|export)\s[^'"`;]*?from\s*['"](\.[^'"]*)['"]|import\s*['"](\.[^'"]*)['"]|import\(\s*['"](\.[^'"]*)['"]\s*\)/g;

let bad = 0;
for (const file of tracked.filter((f) => f.startsWith('src/') && /\.(ts|tsx|js|mjs|css)$/.test(f))) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(re)) {
    const spec = (m[1] ?? m[2] ?? m[3]).split('?')[0];
    const target = posix.normalize(posix.join(dirname(file), spec));
    if (EXT.some((e) => set.has(target + e))) continue;
    const near = EXT.map((e) => lower.get((target + e).toLowerCase())).find(Boolean);
    bad++;
    console.error(`${file}: import "${spec}" ${near ? `differs in case from tracked file ${near}` : 'matches no tracked file'}`);
  }
}
if (bad) {
  console.error(`check-imports: ${bad} bad import(s)`);
  process.exit(1);
}
console.log(`check-imports: ok (${tracked.length} tracked files)`);
