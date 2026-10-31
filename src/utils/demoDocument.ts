import type { PageData } from '../types';
import { createThumbnail } from './canvasRenderer';
import { uid } from './dom';

const WIDTH = 1440;
const HEIGHT = 900;

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function spacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
): void {
  let cursor = x;
  for (const character of text) {
    ctx.fillText(character, cursor, y);
    cursor += ctx.measureText(character).width + spacing;
  }
}

function field(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  options: { mono?: boolean; valueSize?: number } = {},
): void {
  ctx.fillStyle = '#64748b';
  ctx.font = '600 15px Inter, system-ui, sans-serif';
  spacedText(ctx, label.toUpperCase(), x, y, 1.6);
  ctx.fillStyle = '#0f172a';
  ctx.font = options.mono
    ? `600 ${options.valueSize ?? 30}px ui-monospace, Consolas, monospace`
    : `600 ${options.valueSize ?? 30}px Inter, system-ui, sans-serif`;
  ctx.fillText(value, x, y + 36);
}

/**
 * Builds a completely synthetic specimen ID card. It is generated from
 * vector primitives — no network, no bundled personal data, no real person.
 */
export function createDemoPage(): PageData {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Background with a faint guilloche pattern.
  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, '#e8eef8');
  background.addColorStop(1, '#f8fafc');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#93a7c4';
  ctx.lineWidth = 1;
  for (let i = 0; i < 46; i += 1) {
    ctx.beginPath();
    ctx.arc(WIDTH / 2, HEIGHT + 260, 300 + i * 22, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  }
  for (let i = 0; i < 30; i += 1) {
    ctx.beginPath();
    ctx.arc(0, -80, 220 + i * 26, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();
  }
  ctx.restore();

  // Card body.
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, 48, 48, WIDTH - 96, HEIGHT - 96, 26);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  roundedRect(ctx, 48, 48, WIDTH - 96, HEIGHT - 96, 26);
  ctx.stroke();

  // Header band.
  ctx.save();
  roundedRect(ctx, 48, 48, WIDTH - 96, HEIGHT - 96, 26);
  ctx.clip();
  const band = ctx.createLinearGradient(48, 48, WIDTH - 48, 216);
  band.addColorStop(0, '#0b1f3a');
  band.addColorStop(0.6, '#12345f');
  band.addColorStop(1, '#0f2b4d');
  ctx.fillStyle = band;
  ctx.fillRect(48, 48, WIDTH - 96, 168);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(48, 210, WIDTH - 96, 6);
  ctx.restore();

  // Emblem.
  ctx.save();
  ctx.translate(118, 132);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 31, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 30px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('D', 0, 1);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 17px Inter, system-ui, sans-serif';
  spacedText(ctx, 'REPUBLIC OF DEMOLAND', 186, 106, 2.6);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 40px Inter, system-ui, sans-serif';
  spacedText(ctx, 'NATIONAL IDENTITY CARD', 184, 156, 1.1);

  ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
  ctx.font = '600 15px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  spacedText(ctx, 'SPECIMEN · DEMO ONLY', WIDTH - 92 - 190, 156, 2);
  ctx.textAlign = 'left';

  // Photo.
  const photo = ctx.createLinearGradient(92, 260, 372, 560);
  photo.addColorStop(0, '#cbd5e1');
  photo.addColorStop(1, '#94a3b8');
  ctx.fillStyle = photo;
  roundedRect(ctx, 92, 260, 280, 340, 14);
  ctx.fill();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  roundedRect(ctx, 92, 260, 280, 340, 14);
  ctx.stroke();

  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(232, 388, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.ellipse(232, 500, 86, 58, 0, 0, Math.PI * 2);
  ctx.fill();

  // Fields.
  const x = 424;
  field(ctx, 'Surname', 'MORGAN', x, 288);
  field(ctx, 'Given names', 'ALEX JORDAN', x + 300, 288);
  field(ctx, 'Identity number', '0000-0000-0000', x, 382, { mono: true });
  field(ctx, 'Date of birth', '14 MAR 1992', x + 300, 382);
  field(ctx, 'Nationality', 'DEMOLAND', x, 476);
  field(ctx, 'Sex', 'X', x + 300, 476);
  field(ctx, 'Address', '221B SAMPLE STREET, DEMO CITY', x, 570, { valueSize: 26 });

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(92, 636);
  ctx.lineTo(WIDTH - 92, 636);
  ctx.stroke();

  field(ctx, 'Issued', '01 JAN 2024', 92, 690);
  field(ctx, 'Expires', '01 JAN 2034', 360, 690);
  field(ctx, 'Authority', 'DEMO CIVIL REGISTRY', 700, 690, { valueSize: 24 });

  // Signature.
  ctx.fillStyle = '#64748b';
  ctx.font = '600 15px Inter, system-ui, sans-serif';
  spacedText(ctx, 'SIGNATURE', 1080, 690, 1.6);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(1080, 748);
  ctx.bezierCurveTo(1110, 706, 1132, 786, 1160, 734);
  ctx.bezierCurveTo(1180, 700, 1200, 764, 1250, 726);
  ctx.stroke();

  // MRZ strip.
  ctx.fillStyle = '#0f172a';
  roundedRect(ctx, 76, 790, WIDTH - 152, 54, 8);
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 22px ui-monospace, Consolas, monospace';
  ctx.fillText('IDD<<DMO0000000000<<<<<<<<<<<<<<<<<<<<<<<<', 96, 826);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 13px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Synthetic specimen generated locally by RedactZero — not a real document.', WIDTH - 76, 874);
  ctx.textAlign = 'left';

  const page: PageData = {
    id: uid('page'),
    label: 'Demo ID card',
    kind: 'demo',
    source: canvas,
    width: WIDTH,
    height: HEIGHT,
    pointWidth: (WIDTH * 72) / 96,
    pointHeight: (HEIGHT * 72) / 96,
    annotations: [],
    thumbnail: '',
  };
  page.thumbnail = createThumbnail(page);
  return page;
}
