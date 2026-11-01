import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PageData } from '../types';
import { createThumbnail } from './canvasRenderer';
import { uid } from './dom';

let workerReady = false;

/** Rendering every page at 2× is memory-hungry; refuse absurd documents early. */
const MAX_PDF_PAGES = 100;

function isPasswordProtected(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'PasswordException'
  );
}

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  if (!workerReady) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    workerReady = true;
  }
  return pdfjs;
}

/** Renders every PDF page to a high-DPI canvas (2x, razor sharp on retina). */
export async function pdfToPages(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<PageData[]> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  let documentProxy: PDFDocumentProxy;
  try {
    documentProxy = await task.promise;
  } catch (error) {
    if (isPasswordProtected(error)) {
      throw new Error(
        'This PDF is password-protected. Unlock it in your PDF reader, save a copy, then try again.',
      );
    }
    throw error;
  }

  if (documentProxy.numPages > MAX_PDF_PAGES) {
    const pages = documentProxy.numPages;
    await documentProxy.destroy();
    throw new Error(
      `This PDF has ${pages} pages. RedactZero renders every page at 2× in memory, so split it into files of ${MAX_PDF_PAGES} pages or fewer.`,
    );
  }

  const pages: PageData[] = [];
  try {
    for (let index = 1; index <= documentProxy.numPages; index += 1) {
      const pdfPage = await documentProxy.getPage(index);
      const viewport = pdfPage.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas 2D context unavailable');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pdfPage.render({ canvasContext: ctx, viewport }).promise;

      const points = pdfPage.getViewport({ scale: 1 });
      const page: PageData = {
        id: uid('page'),
        label: `${file.name} — page ${index}`,
        kind: 'pdf',
        source: canvas,
        width: canvas.width,
        height: canvas.height,
        pointWidth: points.width,
        pointHeight: points.height,
        annotations: [],
        thumbnail: '',
      };
      page.thumbnail = createThumbnail(page);
      pages.push(page);

      pdfPage.cleanup();
      onProgress?.(index, documentProxy.numPages);
    }
  } finally {
    await documentProxy.destroy();
  }

  return pages;
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      // `from-image` applies the EXIF orientation before we ever draw a pixel.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* Fall through to the <img> decoder. */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    // Keep the URL alive briefly so the rasteriser can still paint the bitmap.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return image;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** Loads an image at its native resolution, stripping EXIF by rasterising it. */
export async function imageToPage(file: File): Promise<PageData> {
  const bitmap = await decodeImage(file);
  const width = 'width' in bitmap ? bitmap.width : 0;
  const height = 'height' in bitmap ? bitmap.height : 0;
  if (!width || !height) throw new Error(`Could not decode ${file.name}`);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0);
  if ('close' in bitmap) bitmap.close();

  const page: PageData = {
    id: uid('page'),
    label: file.name,
    kind: 'image',
    source: canvas,
    width,
    height,
    // 96 CSS px per inch ≈ 72 PDF points per inch.
    pointWidth: (width * 72) / 96,
    pointHeight: (height * 72) / 96,
    annotations: [],
    thumbnail: '',
  };
  page.thumbnail = createThumbnail(page);
  return page;
}

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export function isImageFile(file: File): boolean {
  return (
    /^image\/(png|jpeg|webp)$/.test(file.type) ||
    /\.(png|jpe?g|webp)$/i.test(file.name)
  );
}

/** iPhone photos default to HEIC, which Chrome and Firefox cannot decode. */
export function isHeicFile(file: File): boolean {
  return (
    /^image\/(heic|heif)$/i.test(file.type) ||
    /\.(heic|heif)$/i.test(file.name)
  );
}
