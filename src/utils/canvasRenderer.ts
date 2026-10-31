import type { Annotation, PageData, WatermarkOptions } from '../types';
import { drawWatermark } from './watermarkGenerator';

/**
 * Rasterises one redaction onto a context already transformed into source
 * coordinates. Pixelation samples the *original* source canvas, never the
 * composited output, so boxes cannot "eat" each other.
 */
export function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  page: PageData,
  annotation: Annotation,
): void {
  if (annotation.w <= 0 || annotation.h <= 0) return;

  if (annotation.type === 'blackout') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(annotation.x, annotation.y, annotation.w, annotation.h);
    return;
  }

  if (annotation.type === 'whiteout') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(annotation.x, annotation.y, annotation.w, annotation.h);
    return;
  }

  // Pixelate: clamp the sampling window to the page, then mosaic it back.
  const sx = Math.max(0, annotation.x);
  const sy = Math.max(0, annotation.y);
  const ex = Math.min(page.width, annotation.x + annotation.w);
  const ey = Math.min(page.height, annotation.y + annotation.h);
  const sw = ex - sx;
  const sh = ey - sy;
  if (sw < 1 || sh < 1) return;

  const block = Math.max(6, Math.min(32, Math.round(Math.min(sw, sh) / 9)));
  const columns = Math.max(1, Math.ceil(sw / block));
  const rows = Math.max(1, Math.ceil(sh / block));

  const mosaic = document.createElement('canvas');
  mosaic.width = columns;
  mosaic.height = rows;
  const mosaicCtx = mosaic.getContext('2d');
  if (!mosaicCtx) return;
  mosaicCtx.imageSmoothingEnabled = true;
  mosaicCtx.drawImage(page.source, sx, sy, sw, sh, 0, 0, columns, rows);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mosaic, 0, 0, columns, rows, sx, sy, sw, sh);
  ctx.restore();
}

export interface FlattenOptions {
  watermark?: WatermarkOptions;
  /** Fill behind the document (needed for JPEG/PDF, which have no alpha). */
  background?: string;
}

/** Bakes the source page, every redaction and the watermark into one canvas. */
export function flattenPage(page: PageData, options: FlattenOptions = {}): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = page.width;
  output.height = page.height;
  const ctx = output.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, page.width, page.height);
  }

  ctx.drawImage(page.source, 0, 0);
  for (const annotation of page.annotations) {
    drawAnnotation(ctx, page, annotation);
  }
  if (options.watermark) {
    drawWatermark(ctx, page.width, page.height, options.watermark);
  }

  return output;
}

export function createThumbnail(page: PageData, maxWidth = 180): string {
  const scale = Math.min(1, maxWidth / page.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(page.width * scale));
  canvas.height = Math.max(1, Math.round(page.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(page.source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
}
