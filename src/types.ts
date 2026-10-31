export type Tool = 'select' | 'blackout' | 'pixelate' | 'whiteout' | 'hand';

export type RedactionType = 'blackout' | 'pixelate' | 'whiteout';

export interface Annotation {
  id: string;
  type: RedactionType;
  /** Position and size in source-document pixel coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PageData {
  id: string;
  label: string;
  kind: 'image' | 'pdf' | 'demo';
  /** Full-resolution raster of the original page. Never leaves memory. */
  source: HTMLCanvasElement;
  width: number;
  height: number;
  /** Physical page size in PDF points, used when rebuilding a PDF. */
  pointWidth: number;
  pointHeight: number;
  annotations: Annotation[];
  thumbnail: string;
}

export interface WatermarkOptions {
  text: string;
  /** Recipient / company used by the quick presets. */
  recipient: string;
  /** Degrees, clockwise. */
  angle: number;
  /** 0 – 1 */
  opacity: number;
  /** Font size in source-document pixels. */
  fontSize: number;
  color: string;
  /** 1 (sparse) – 5 (dense) */
  density: number;
  enabled: boolean;
}

export type ExportFormat = 'png' | 'jpeg' | 'pdf';

export interface ExportResult {
  blob: Blob;
  filename: string;
  mime: string;
  pageCount: number;
  width: number;
  height: number;
  scan: {
    clean: boolean;
    findings: string[];
    checked: string[];
  };
}

export interface LoadProgress {
  label: string;
  done: number;
  total: number;
}
