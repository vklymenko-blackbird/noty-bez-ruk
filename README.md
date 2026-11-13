# Ноти без рук

A PWA sheet-music reader for iPad. Find a free score, put the iPad on the stand, turn pages with a head turn. All UI text is Ukrainian.

## Commands

- `npm ci` installs packages and copies vendor assets (MediaPipe wasm, pdf.js data) into `public/`.
- `npm run dev` starts the dev server (port from the lane, default 3200).
- `npm run build` builds into `dist/` and checks it (`scripts/check-dist.mjs`).
- `npm run lint`, `npm run typecheck`, `npm test` run the static and unit checks.
- `npm run e2e` runs Playwright against the built app (Playwright 1.63.0; browsers must already be installed).
- `npm run fixtures` regenerates the PDF fixtures and pose traces. `npm run icons` regenerates the icons.

## Test mode

Open the app with `?test=1`. Then `window.__notyTest` exists, the pose source is injected (add `&camera=1` for the real camera), the service worker is off (add `&sw=1` to enable it), and the `#/dev/...` harness routes work.

## Privacy

The camera runs only in play mode, only inside the page. Nothing is stored or sent. No analytics.

## Licences

Fonts Cormorant Garamond and Commissioner (OFL). Icons Lucide (ISC). PDF.js (Apache-2.0). MediaPipe (Apache-2.0). Scores keep their own licences, shown next to each score. The repo holds only generated fixtures.
