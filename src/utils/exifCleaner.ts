const decoder = new TextDecoder('ascii');

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return decoder.decode(bytes.subarray(start, start + length));
}

export interface MetadataScan {
  clean: boolean;
  findings: string[];
  checked: string[];
}

function result(findings: Set<string>, checked: Set<string>): MetadataScan {
  return {
    clean: findings.size === 0,
    findings: [...findings],
    checked: [...checked],
  };
}

function scanJpeg(bytes: Uint8Array): MetadataScan {
  const findings = new Set<string>();
  const checked = new Set<string>(['JPEG segment table']);
  let offset = 2;

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    // Start of scan / end of image: stop walking headers.
    if (marker === 0xda || marker === 0xd9) break;

    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) break;
    const segment = bytes.subarray(offset + 4, offset + 2 + length);

    if (marker === 0xe1) {
      const header = ascii(segment, 0, Math.min(segment.length, 80));
      if (header.startsWith('Exif')) {
        findings.add('EXIF block (camera model, timestamps, GPS)');
      } else if (header.includes('ns.adobe.com/xap')) {
        findings.add('XMP metadata packet');
      } else if (header.includes('ns.adobe.com/xmp')) {
        findings.add('XMP metadata packet');
      }
      checked.add('APP1 (EXIF/XMP)');
    } else if (marker === 0xed) {
      findings.add('Photoshop / IPTC APP13 block');
      checked.add('APP13 (IPTC)');
    } else if (marker === 0xee) {
      findings.add('Adobe APP14 colour metadata');
      checked.add('APP14 (Adobe)');
    } else if (marker === 0xfe) {
      findings.add('JPEG comment segment');
      checked.add('COM comment');
    }

    offset += 2 + length;
  }

  return result(findings, checked);
}

function scanPng(bytes: Uint8Array): MetadataScan {
  const findings = new Set<string>();
  const checked = new Set<string>(['PNG chunk table']);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;

  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = ascii(bytes, offset + 4, 4);
    if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      findings.add('PNG text chunk (software, author or comments)');
      checked.add('PNG text chunks');
    } else if (type === 'eXIf') {
      findings.add('PNG eXIf block (camera metadata)');
      checked.add('PNG eXIf');
    } else if (type === 'tIME') {
      findings.add('PNG last-modification timestamp');
      checked.add('PNG tIME');
    }
    offset += 12 + length;
    if (type === 'IEND') break;
  }

  return result(findings, checked);
}

function scanPdf(bytes: Uint8Array): MetadataScan {
  const findings = new Set<string>();
  const checked = new Set<string>(['PDF document info dictionary']);
  const text = new TextDecoder('latin1').decode(bytes);

  if (text.includes('ns.adobe.com/xap')) {
    findings.add('XMP metadata packet');
    checked.add('XMP packet');
  }
  if (/\/Author\s*[\(<]/.test(text)) findings.add('PDF /Author field');
  if (/\/Subject\s*[\(<]/.test(text)) findings.add('PDF /Subject field');
  if (/\/Keywords\s*[\(<]/.test(text)) findings.add('PDF /Keywords field');
  if (/\/Company\s*[\(<]/.test(text)) findings.add('PDF /Company field');

  return result(findings, checked);
}

/** Reads the exported bytes back and looks for metadata markers that survived. */
export async function scanForMetadata(blob: Blob, mime: string): Promise<MetadataScan> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (mime === 'image/jpeg') return scanJpeg(bytes);
  if (mime === 'image/png') return scanPng(bytes);
  if (mime === 'application/pdf') return scanPdf(bytes);
  return { clean: true, findings: [], checked: [] };
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(`This browser could not encode ${type}.`));
      },
      type,
      quality,
    );
  });
}
