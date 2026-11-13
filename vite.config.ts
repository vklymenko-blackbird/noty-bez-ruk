/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { lanePorts } from './scripts/lane.mjs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const ports = lanePorts();

const CSP =
  "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self' https://commons.wikimedia.org https://upload.wikimedia.org; media-src 'self' blob:; manifest-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'";

/** Injects the CSP meta tag as the first element of <head>. Build only (the dev server needs inline styles). */
function cspPlugin(): Plugin {
  return {
    name: 'noty-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler() {
        return [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}

export default defineConfig({
  base: '/noty-bez-ruk/',
  plugins: [
    preact(),
    cspPlugin(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Ноти без рук',
        short_name: 'Ноти',
        lang: 'uk',
        start_url: '/noty-bez-ruk/',
        scope: '/noty-bez-ruk/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F6F1E7',
        theme_color: '#F6F1E7',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: [
          '**/*.{js,mjs,css,html,woff2,png,svg,json,mp4}',
          'mediapipe/face_landmarker.task',
          'mediapipe/wasm/vision_wasm_internal.*',
          'pdfjs/wasm/*',
        ],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && (url.pathname.startsWith('/noty-bez-ruk/pdfjs/') || url.pathname.startsWith('/noty-bez-ruk/mediapipe/')),
            handler: 'CacheFirst',
            options: { cacheName: 'vendor-assets' },
          },
        ],
      },
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { port: ports.dev, strictPort: true, host: '127.0.0.1' },
  preview: { port: ports.preview, strictPort: true },
  test: {
    environment: 'happy-dom',
    setupFiles: ['tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
