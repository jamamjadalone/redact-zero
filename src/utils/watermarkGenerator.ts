import type { WatermarkOptions } from '../types';
import { clamp } from './dom';

export const WATERMARK_FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const cache = new Map<string, HTMLCanvasElement>();
const MAX_CACHE_ENTRIES = 3;
/** Above this many pixels we paint directly instead of caching a full layer. */
const CACHE_PIXEL_LIMIT = 12_000_000;

function cacheKey(width: number, height: number, options: WatermarkOptions): string {
  return [
    width,
    height,
    options.text,
    options.angle,
    options.opacity,
    options.fontSize,
    options.color,
    options.density,
  ].join('|');
}

function paintLayer(
  width: number,
  height: number,
  options: WatermarkOptions,
): HTMLCanvasElement {
  const layer = document.createElement('canvas');
  layer.width = Math.max(1, Math.round(width));
  layer.height = Math.max(1, Math.round(height));
  const ctx = layer.getContext('2d');
  if (!ctx) return layer;

  const text = options.text.replace(/\s+/g, ' ').trim();
  if (!text) return layer;

  const fontSize = clamp(options.fontSize, 6, 400);
  const opacity = clamp(options.opacity, 0, 1);
  const density = clamp(options.density, 1, 5);
  const angle = (clamp(options.angle, -90, 90) * Math.PI) / 180;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = options.color;
  ctx.font = `700 ${fontSize}px ${WATERMARK_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textWidth = Math.max(ctx.measureText(text).width, fontSize * 4);
  const gapX = textWidth + fontSize * (0.9 + (5 - density) * 0.5);
  const gapY = fontSize * (1.7 + (5 - density) * 0.8);
  const diagonal = Math.hypot(width, height);

  ctx.translate(width / 2, height / 2);
  ctx.rotate(angle);

  let row = 0;
  for (let y = -diagonal / 2; y <= diagonal / 2; y += gapY, row += 1) {
    const offset = row % 2 === 0 ? 0 : gapX / 2;
    for (let x = -diagonal / 2 - offset; x <= diagonal / 2; x += gapX) {
      ctx.fillText(text, x, y);
    }
  }

  ctx.restore();
  return layer;
}

/**
 * Tiles rotated, semi-transparent text across the whole page. Layers are
 * cached per page size + settings so dragging a box does not re-tile text on
 * every animation frame. Preview and export share the exact same pixels.
 */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: WatermarkOptions,
): void {
  if (!options.enabled) return;
  if (!options.text.trim()) return;

  if (width * height > CACHE_PIXEL_LIMIT) {
    ctx.drawImage(paintLayer(width, height, options), 0, 0);
    return;
  }

  const key = cacheKey(width, height, options);
  let layer = cache.get(key);
  if (!layer) {
    layer = paintLayer(width, height, options);
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(key, layer);
  }
  ctx.drawImage(layer, 0, 0);
}
