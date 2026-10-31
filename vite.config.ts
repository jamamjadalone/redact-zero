import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// The site is published as a GitHub Pages *project* site, so it lives under
// /redact-zero/. Override with VITE_BASE=/ if you deploy to a root domain.
const base = process.env.VITE_BASE ?? '/redact-zero/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered manually in src/main.ts so we can surface updates
      manifest: false, // we ship a hand-written public/manifest.json
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,json,webmanifest}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        // The pdf.js worker is a large asset; precaching it keeps PDF support offline.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
});
