import type { ExportFormat, ExportResult, PageData, WatermarkOptions } from '../types';
import { flattenPage } from './canvasRenderer';
import { nextFrame, safeBaseName, timestampSlug } from './dom';
import { canvasToBlob, scanForMetadata } from './exifCleaner';

export interface ExportRequest {
  pages: PageData[];
  format: ExportFormat;
  /** 0.4 – 1.0, used for JPEG output and PDF page encoding. */
  quality: number;
  watermark?: WatermarkOptions;
  baseName: string;
}

export type ProgressFn = (label: string, fraction: number) => void;

function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type });
}

export async function exportDocument(
  request: ExportRequest,
  onProgress: ProgressFn = () => {},
): Promise<ExportResult> {
  const { pages, format, quality, watermark, baseName } = request;
  if (pages.length === 0) throw new Error('There is nothing to export yet.');

  const stamp = timestampSlug();
  const slug = safeBaseName(baseName || 'document');
  const safeQuality = Math.min(1, Math.max(0.4, quality));

  if (format === 'pdf') {
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    pdf.setTitle('Redacted document');
    pdf.setProducer('RedactZero (client-side)');
    pdf.setCreator('RedactZero');
    const now = new Date();
    pdf.setCreationDate(now);
    pdf.setModificationDate(now);

    let firstWidth = pages[0].pointWidth;
    let firstHeight = pages[0].pointHeight;

    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      onProgress(
        `Flattening page ${index + 1} of ${pages.length}…`,
        0.05 + (index / pages.length) * 0.85,
      );
      await nextFrame();

      const canvas = flattenPage(page, { watermark, background: '#ffffff' });
      const dataUrl = canvas.toDataURL('image/jpeg', safeQuality);
      const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

      const image = await pdf.embedJpg(bytes);
      const pdfPage = pdf.addPage([page.pointWidth, page.pointHeight]);
      pdfPage.drawImage(image, {
        x: 0,
        y: 0,
        width: page.pointWidth,
        height: page.pointHeight,
      });

      if (index === 0) {
        firstWidth = page.pointWidth;
        firstHeight = page.pointHeight;
      }
    }

    onProgress('Sealing flattened PDF…', 0.94);
    await nextFrame();
    const bytes = await pdf.save({ useObjectStreams: true });
    const blob = bytesToBlob(bytes, 'application/pdf');
    const scan = await scanForMetadata(blob, 'application/pdf');
    onProgress('Done', 1);

    return {
      blob,
      filename: `${slug}-redacted-${stamp}.pdf`,
      mime: 'application/pdf',
      pageCount: pages.length,
      width: Math.round(firstWidth),
      height: Math.round(firstHeight),
      scan,
    };
  }

  const page = pages[0];
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  onProgress('Baking redactions into pixels…', 0.35);
  await nextFrame();

  const canvas = flattenPage(page, {
    watermark,
    background: format === 'jpeg' ? '#ffffff' : undefined,
  });

  onProgress('Re-encoding without metadata…', 0.7);
  await nextFrame();

  const blob = await canvasToBlob(canvas, mime, format === 'jpeg' ? safeQuality : undefined);
  const scan = await scanForMetadata(blob, mime);
  onProgress('Done', 1);

  return {
    blob,
    filename: `${slug}-redacted-${stamp}.${format === 'png' ? 'png' : 'jpg'}`,
    mime,
    pageCount: 1,
    width: page.width,
    height: page.height,
    scan,
  };
}
