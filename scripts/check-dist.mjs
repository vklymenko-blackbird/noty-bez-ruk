// Fails the build when dist/ breaks the security rules of SPEC 1.9.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const FORBIDDEN = ['cdn.jsdelivr.net', 'unpkg.com', 'storage.googleapis.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
// Narrow exceptions for dead code inside libraries: { file substring, host }. Add a reason for each.
const EXCEPTIONS = [];
const TEXT = new Set(['.js', '.mjs', '.css', '.html', '.json', '.webmanifest', '.svg']);

const problems = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (TEXT.has(extname(p))) {
      const text = readFileSync(p, 'utf8');
      for (const host of FORBIDDEN) {
        if (text.includes(host) && !EXCEPTIONS.some((e) => p.includes(e.file) && e.host === host)) {
          problems.push(`${p.slice(dist.length + 1)} contains ${host}`);
        }
      }
    }
  }
}
walk(dist);

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const headStart = html.indexOf('<head>');
const firstTag = html.slice(headStart + 6).match(/<\s*(meta|link|script|title|style)\b[^>]*>/i);
if (!/http-equiv="Content-Security-Policy"/i.test(html)) problems.push('dist/index.html has no CSP meta tag');
else if (!firstTag || !/Content-Security-Policy/i.test(firstTag[0])) problems.push('CSP meta tag is not the first element in <head>');
for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (m[2].trim() !== '') problems.push('dist/index.html has an inline <script> with content');
}

if (problems.length) {
  console.error('check-dist FAILED:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('check-dist: ok');
