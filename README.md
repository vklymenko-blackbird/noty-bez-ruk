# Ноти без рук

A PWA sheet-music reader for iPad. You find a free score, put the iPad on the stand, and turn pages with a head turn, a pedal or a tap. All UI text is Ukrainian.

## Run

- `npm ci` installs packages and copies vendor assets (MediaPipe wasm, pdf.js data) into `public/`.
- `npm run dev` starts the dev server.
- `npm test` runs the unit tests. `npm run lint` and `npm run typecheck` run the static checks.
- `npm run e2e` runs Playwright against the built app (Playwright 1.63.0; browsers must already be installed).
- `npm run build` builds into `dist/` and checks it (`scripts/check-dist.mjs`).
- `npm run fixtures` regenerates the PDF fixtures and pose traces. `npm run icons` regenerates the icons.

### Ports

The dev server and Playwright read the `PORT` environment variable. The default is 5173. Example: `PORT=3210 npm run e2e`.

## Test mode

Open the app with `?test=1`. Then `window.__notyTest` exists, the pose source is injected (add `&camera=1` for the real camera), the service worker is off (add `&sw=1` to enable it), and the `#/dev/...` harness routes work.

## Where scores come from

- Your own PDF files, opened from the library.
- A small built-in catalogue and a search of Wikimedia Commons by title.
- Only scores with a free licence (public domain or Creative Commons) are offered. The licence is shown on every search card and next to every score. A score without a clear free licence is not offered.

## Privacy

The camera runs only in play mode, only on the device. Nothing from the camera is stored or sent. There is no analytics. The only data that leaves the device is the search text, sent to Wikimedia Commons.

## Supported iPadOS

Target: iPad mini 6 or 7, in Safari or as an app on the Home Screen. Expected minimum: iPadOS 16.4 (not yet tested on a real device). The camera needs a secure origin (HTTPS). See `docs/IPAD-CHECKLIST.md` for the manual check on a real iPad.

## Credits and licences

- Fonts: Cormorant Garamond and Commissioner (SIL OFL).
- Icons: Lucide (ISC).
- pdf.js and MediaPipe (Apache 2.0).
- Scores keep their own licences. The repository holds only generated fixtures.
