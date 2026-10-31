/**
 * Generates the PWA icon set with zero image dependencies.
 * Rasterises the RedactZero mark with 4x supersampling and writes PNGs
 * using Node's built-in zlib (no sharp / canvas native builds required).
 *
 * Usage: npm run icons
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public');
mkdirSync(outDir, { recursive: true });

/* ------------------------------------------------------------------ */
/* PNG encoder                                                         */
/* ------------------------------------------------------------------ */

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // no filter
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ */
/* Vector-ish rasteriser                                               */
/* ------------------------------------------------------------------ */

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const mix = (a, b, t) => a + (b - a) * t;

function insideRoundedRect(u, v, x0, y0, x1, y1, r) {
  if (u < x0 || u > x1 || v < y0 || v > y1) return false;
  const cx = clamp(u, x0 + r, x1 - r);
  const cy = clamp(v, y0 + r, y1 - r);
  const dx = u - cx;
  const dy = v - cy;
  return dx * dx + dy * dy <= r * r;
}

function segmentDistance(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len = vx * vx + vy * vy || 1;
  const t = clamp((wx * vx + wy * vy) / len, 0, 1);
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function renderIcon(size, { maskable = false } = {}) {
  const SS = 4;
  const N = size * SS;
  const pixels = Buffer.alloc(N * N * 4, 0);
  const contentScale = maskable ? 0.76 : 1;
  const offset = (1 - contentScale) / 2;

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N;
      const v = (y + 0.5) / N;
      const i = (y * N + x) * 4;

      // Full-bleed background (safe for maskable crops).
      let r = mix(22, 7, (u + v) / 2);
      let g = mix(35, 11, (u + v) / 2);
      let b = mix(61, 19, (u + v) / 2);

      // Warm glow from the top-right corner.
      const glow = clamp(1 - Math.hypot(u - 0.92, v - 0.08) / 0.85, 0, 1);
      r = mix(r, 239, glow * 0.28);
      g = mix(g, 68, glow * 0.16);
      b = mix(b, 68, glow * 0.12);

      // Content space (inset for maskable).
      const cu = (u - offset) / contentScale;
      const cv = (v - offset) / contentScale;

      if (cu >= 0 && cu <= 1 && cv >= 0 && cv <= 1) {
        // Soft document shadow.
        if (insideRoundedRect(cu, cv, 0.2, 0.155, 0.805, 0.885, 0.08)) {
          r = mix(r, 0, 0.35);
          g = mix(g, 0, 0.35);
          b = mix(b, 0, 0.35);
        }

        // Document sheet.
        if (insideRoundedRect(cu, cv, 0.205, 0.14, 0.795, 0.86, 0.07)) {
          r = 238;
          g = 244;
          b = 255;
        }

        // Red spine accent, clipped to the sheet.
        if (
          insideRoundedRect(cu, cv, 0.205, 0.14, 0.795, 0.86, 0.07) &&
          insideRoundedRect(cu, cv, 0.205, 0.14, 0.247, 0.86, 0.02)
        ) {
          r = 239;
          g = 68;
          b = 68;
        }

        // Redaction bars.
        const bar = (x0, y0, x1, y1, cr, cg, cb) => {
          if (insideRoundedRect(cu, cv, x0, y0, x1, y1, 0.028)) {
            r = cr;
            g = cg;
            b = cb;
            return true;
          }
          return false;
        };
        bar(0.3, 0.27, 0.61, 0.335, 11, 18, 32) ||
          bar(0.3, 0.39, 0.655, 0.455, 11, 18, 32) ||
          bar(0.3, 0.51, 0.55, 0.575, 11, 18, 32) ||
          bar(0.3, 0.63, 0.625, 0.695, 239, 68, 68);

        // Verification badge.
        const badgeDist = Math.hypot(cu - 0.755, cv - 0.76);
        if (badgeDist <= 0.185) {
          if (badgeDist > 0.158) {
            r = 7;
            g = 11;
            b = 19;
          } else {
            r = 16;
            g = 185;
            b = 129;
          }
        }

        // Check mark inside the badge.
        const d1 = segmentDistance(cu, cv, 0.668, 0.762, 0.728, 0.82);
        const d2 = segmentDistance(cu, cv, 0.728, 0.82, 0.845, 0.695);
        if (Math.min(d1, d2) < 0.022) {
          r = 4;
          g = 18;
          b = 12;
        }
      }

      pixels[i] = Math.round(clamp(r, 0, 255));
      pixels[i + 1] = Math.round(clamp(g, 0, 255));
      pixels[i + 2] = Math.round(clamp(b, 0, 255));
      pixels[i + 3] = 255;
    }
  }

  // Box-filter downsample for smooth edges.
  const out = Buffer.alloc(size * size * 4);
  const samples = SS * SS;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * N + (x * SS + sx)) * 4;
          r += pixels[i];
          g += pixels[i + 1];
          b += pixels[i + 2];
        }
      }
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / samples);
      out[o + 1] = Math.round(g / samples);
      out[o + 2] = Math.round(b / samples);
      out[o + 3] = 255;
    }
  }
  return encodePng(size, out);
}

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, {}],
];

for (const [name, size, options] of targets) {
  const png = renderIcon(size, options);
  writeFileSync(resolve(outDir, name), png);
  console.log(`wrote public/${name} (${size}x${size}, ${(png.length / 1024).toFixed(1)} KB)`);
}
