import { store } from '../state';
import type { Annotation, RedactionType } from '../types';
import { drawAnnotation } from '../utils/canvasRenderer';
import { clamp, uid } from '../utils/dom';
import { drawWatermark } from '../utils/watermarkGenerator';

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface Interaction {
  mode: 'draw' | 'move' | 'resize' | 'pan';
  pointerId: number;
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
  startSourceX: number;
  startSourceY: number;
  handle?: Handle;
  origin?: Annotation;
  moved: boolean;
}

const HANDLE_CURSORS: Record<Handle, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

const MIN_SIZE = 12;

export class CanvasEditor {
  readonly element: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly unsubscribe: () => void;
  private readonly resizeObserver: ResizeObserver;
  private readonly onKeyDown: (event: KeyboardEvent) => void;
  private readonly onKeyUp: (event: KeyboardEvent) => void;

  private draft: Annotation | null = null;
  private selectedId: string | null = null;
  private interaction: Interaction | null = null;
  private spaceDown = false;
  private frame = 0;
  private lastPageId = '';
  private hoverCursor = 'default';

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'absolute inset-0';

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'editor-canvas';
    this.canvas.className = 'block h-full w-full';
    this.canvas.setAttribute('aria-label', 'Document redaction canvas');
    this.element.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });

    this.onKeyDown = (event) => {
      if (isTypingTarget(event.target)) return;
      if (event.code === 'Space' && !this.spaceDown) {
        this.spaceDown = true;
        this.updateCursor();
        if (store.page) event.preventDefault();
      }
    };
    this.onKeyUp = (event) => {
      if (event.code === 'Space') {
        this.spaceDown = false;
        this.updateCursor();
      }
    };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    this.resizeObserver = new ResizeObserver(() => {
      if (store.fitMode) this.fit();
      else this.scheduleRender();
    });
    this.resizeObserver.observe(this.element);

    this.unsubscribe = store.subscribe(() => this.sync());
    this.scheduleRender();
  }

  destroy(): void {
    this.unsubscribe();
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    if (this.frame) cancelAnimationFrame(this.frame);
  }

  /* ---------------------------------------------------------------- */
  /* View controls                                                     */
  /* ---------------------------------------------------------------- */

  fit(): void {
    const page = store.page;
    const rect = this.element.getBoundingClientRect();
    if (!page || rect.width < 24 || rect.height < 24) return;
    const padding = rect.width < 640 ? 20 : 48;
    const scale = Math.min(
      (rect.width - padding * 2) / page.width,
      (rect.height - padding * 2) / page.height,
    );
    store.zoom = clamp(scale, 0.05, 8);
    store.offsetX = (rect.width - page.width * store.zoom) / 2;
    store.offsetY = (rect.height - page.height * store.zoom) / 2;
    store.fitMode = true;
    store.emit();
  }

  zoomBy(factor: number): void {
    const rect = this.element.getBoundingClientRect();
    this.zoomAt(store.zoom * factor, rect.width / 2, rect.height / 2);
  }

  zoomAt(nextZoom: number, anchorX: number, anchorY: number): void {
    if (!store.page) return;
    const zoom = clamp(nextZoom, 0.05, 8);
    const ratio = zoom / store.zoom;
    store.offsetX = anchorX - (anchorX - store.offsetX) * ratio;
    store.offsetY = anchorY - (anchorY - store.offsetY) * ratio;
    store.zoom = zoom;
    store.fitMode = false;
    store.emit();
  }

  /* ---------------------------------------------------------------- */
  /* Rendering                                                         */
  /* ---------------------------------------------------------------- */

  private sync(): void {
    const page = store.page;
    if (!page) {
      this.lastPageId = '';
      this.selectedId = null;
      this.draft = null;
      this.scheduleRender();
      return;
    }
    if (page.id !== this.lastPageId) {
      this.lastPageId = page.id;
      this.selectedId = null;
      this.draft = null;
      this.fit();
      return;
    }
    if (this.selectedId && !page.annotations.some((a) => a.id === this.selectedId)) {
      this.selectedId = null;
    }
    this.updateCursor();
    this.scheduleRender();
  }

  private scheduleRender(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  private render(): void {
    const rect = this.element.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cssWidth = Math.max(1, Math.round(rect.width));
    const cssHeight = Math.max(1, Math.round(rect.height));
    const pixelWidth = Math.round(cssWidth * dpr);
    const pixelHeight = Math.round(cssHeight * dpr);

    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }

    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const page = store.page;
    if (!page) return;

    const zoom = store.zoom;
    const offsetX = store.offsetX;
    const offsetY = store.offsetY;

    // Page drop shadow.
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(offsetX, offsetY, page.width * zoom, page.height * zoom);
    ctx.restore();

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoom, zoom);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(page.source, 0, 0);

    for (const annotation of page.annotations) {
      drawAnnotation(ctx, page, annotation);
    }
    if (this.draft) drawAnnotation(ctx, page, this.draft);
    if (store.watermark.enabled) {
      drawWatermark(ctx, page.width, page.height, store.watermark);
    }
    ctx.restore();

    // Page outline.
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.round(offsetX) - 0.5,
      Math.round(offsetY) - 0.5,
      Math.round(page.width * zoom) + 1,
      Math.round(page.height * zoom) + 1,
    );

    const selected = page.annotations.find((a) => a.id === this.selectedId);
    if (selected && store.tool === 'select') this.drawSelection(selected);
  }

  private drawSelection(annotation: Annotation): void {
    const zoom = store.zoom;
    const x = store.offsetX + annotation.x * zoom;
    const y = store.offsetY + annotation.y * zoom;
    const width = annotation.w * zoom;
    const height = annotation.h * zoom;

    this.ctx.save();
    this.ctx.strokeStyle = '#34d399';
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([5, 4]);
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.setLineDash([]);

    for (const point of handlePoints({ x, y, w: width, h: height })) {
      this.ctx.fillStyle = '#05080f';
      this.ctx.strokeStyle = '#34d399';
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.roundRect(point.x - 4.5, point.y - 4.5, 9, 9, 2);
      this.ctx.fill();
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  /* ---------------------------------------------------------------- */
  /* Pointer interaction                                               */
  /* ---------------------------------------------------------------- */

  private get page() {
    return store.page;
  }

  private screenPoint(event: PointerEvent | WheelEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private sourcePoint(event: PointerEvent | WheelEvent) {
    const screen = this.screenPoint(event);
    return {
      x: (screen.x - store.offsetX) / store.zoom,
      y: (screen.y - store.offsetY) / store.zoom,
    };
  }

  private screenRect(annotation: Annotation) {
    return {
      x: store.offsetX + annotation.x * store.zoom,
      y: store.offsetY + annotation.y * store.zoom,
      w: annotation.w * store.zoom,
      h: annotation.h * store.zoom,
    };
  }

  private handleAt(screenX: number, screenY: number): Handle | null {
    const page = this.page;
    if (!page || !this.selectedId) return null;
    const annotation = page.annotations.find((a) => a.id === this.selectedId);
    if (!annotation) return null;
    for (const point of handlePoints(this.screenRect(annotation))) {
      if (Math.abs(screenX - point.x) <= 9 && Math.abs(screenY - point.y) <= 9) {
        return point.handle;
      }
    }
    return null;
  }

  private annotationAt(sourceX: number, sourceY: number): Annotation | null {
    const page = this.page;
    if (!page) return null;
    for (let index = page.annotations.length - 1; index >= 0; index -= 1) {
      const a = page.annotations[index];
      if (sourceX >= a.x && sourceX <= a.x + a.w && sourceY >= a.y && sourceY <= a.y + a.h) {
        return a;
      }
    }
    return null;
  }

  private handlePointerDown = (event: PointerEvent): void => {
    const page = this.page;
    if (!page) return;
    const source = this.sourcePoint(event);
    const screen = this.screenPoint(event);
    const isPanGesture = event.button === 1 || this.spaceDown || store.tool === 'hand';

    this.canvas.setPointerCapture(event.pointerId);
    event.preventDefault();

    if (isPanGesture) {
      this.interaction = {
        mode: 'pan',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startOffsetX: store.offsetX,
        startOffsetY: store.offsetY,
        startSourceX: source.x,
        startSourceY: source.y,
        moved: false,
      };
      this.updateCursor();
      return;
    }

    if (store.tool === 'select') {
      const handle = this.handleAt(screen.x, screen.y);
      if (handle && this.selectedId) {
        const annotation = page.annotations.find((a) => a.id === this.selectedId);
        if (annotation) {
          this.interaction = {
            mode: 'resize',
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startOffsetX: store.offsetX,
            startOffsetY: store.offsetY,
            startSourceX: source.x,
            startSourceY: source.y,
            handle,
            origin: { ...annotation },
            moved: false,
          };
          return;
        }
      }

      const hit = this.annotationAt(source.x, source.y);
      this.selectedId = hit?.id ?? null;
      if (hit) {
        this.interaction = {
          mode: 'move',
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startOffsetX: store.offsetX,
          startOffsetY: store.offsetY,
          startSourceX: source.x,
          startSourceY: source.y,
          origin: { ...hit },
          moved: false,
        };
      }
      this.scheduleRender();
      return;
    }

    const startX = clamp(source.x, 0, page.width);
    const startY = clamp(source.y, 0, page.height);
    this.draft = {
      id: uid('box'),
      type: store.tool as RedactionType,
      x: startX,
      y: startY,
      w: 0,
      h: 0,
    };
    this.interaction = {
      mode: 'draw',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: store.offsetX,
      startOffsetY: store.offsetY,
      startSourceX: startX,
      startSourceY: startY,
      moved: false,
    };
    this.scheduleRender();
  };

  private handlePointerMove = (event: PointerEvent): void => {
    const page = this.page;
    if (!page) return;

    if (!this.interaction) {
      if (store.tool === 'select') {
        const screen = this.screenPoint(event);
        const handle = this.handleAt(screen.x, screen.y);
        const source = this.sourcePoint(event);
        const hit = handle ? null : this.annotationAt(source.x, source.y);
        this.hoverCursor = handle
          ? HANDLE_CURSORS[handle]
          : hit
            ? 'move'
            : 'default';
      } else {
        this.hoverCursor = store.tool === 'hand' ? 'grab' : 'crosshair';
      }
      this.updateCursor();
      return;
    }

    if (event.pointerId !== this.interaction.pointerId) return;
    this.interaction.moved = true;

    if (this.interaction.mode === 'pan') {
      store.offsetX =
        this.interaction.startOffsetX + (event.clientX - this.interaction.startX);
      store.offsetY =
        this.interaction.startOffsetY + (event.clientY - this.interaction.startY);
      store.fitMode = false;
      this.scheduleRender();
      return;
    }

    const source = this.sourcePoint(event);

    if (this.interaction.mode === 'draw' && this.draft) {
      const currentX = clamp(source.x, 0, page.width);
      const currentY = clamp(source.y, 0, page.height);
      const startX = this.interaction.startSourceX;
      const startY = this.interaction.startSourceY;
      this.draft.x = Math.min(startX, currentX);
      this.draft.y = Math.min(startY, currentY);
      this.draft.w = Math.abs(currentX - startX);
      this.draft.h = Math.abs(currentY - startY);
      this.scheduleRender();
      return;
    }

    const origin = this.interaction.origin;
    if (!origin) return;
    const annotation = page.annotations.find((a) => a.id === origin.id);
    if (!annotation) return;

    const dx = (event.clientX - this.interaction.startX) / store.zoom;
    const dy = (event.clientY - this.interaction.startY) / store.zoom;

    if (this.interaction.mode === 'move') {
      annotation.x = clamp(origin.x + dx, 0, Math.max(0, page.width - origin.w));
      annotation.y = clamp(origin.y + dy, 0, Math.max(0, page.height - origin.h));
      this.scheduleRender();
      return;
    }

    if (this.interaction.mode === 'resize' && this.interaction.handle) {
      const handle = this.interaction.handle;
      let { x, y, w, h } = origin;
      if (handle.includes('e')) {
        w = clamp(origin.w + dx, MIN_SIZE, page.width - origin.x);
      }
      if (handle.includes('s')) {
        h = clamp(origin.h + dy, MIN_SIZE, page.height - origin.y);
      }
      if (handle.includes('w')) {
        const nextX = clamp(origin.x + dx, 0, origin.x + origin.w - MIN_SIZE);
        w = origin.x + origin.w - nextX;
        x = nextX;
      }
      if (handle.includes('n')) {
        const nextY = clamp(origin.y + dy, 0, origin.y + origin.h - MIN_SIZE);
        h = origin.y + origin.h - nextY;
        y = nextY;
      }
      annotation.x = x;
      annotation.y = y;
      annotation.w = w;
      annotation.h = h;
      this.scheduleRender();
    }
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (this.interaction && event.pointerId !== this.interaction.pointerId) return;
    const interaction = this.interaction;
    this.interaction = null;

    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }

    if (!interaction) return;

    if (interaction.mode === 'draw') {
      const draft = this.draft;
      this.draft = null;
      if (draft && draft.w >= 6 && draft.h >= 6) {
        this.page?.annotations.push(draft);
        store.commit();
      } else {
        this.scheduleRender();
      }
    } else if ((interaction.mode === 'move' || interaction.mode === 'resize') && interaction.moved) {
      store.commit();
    }

    this.updateCursor();
  };

  private handlePointerLeave = (): void => {
    if (this.interaction) return;
    this.hoverCursor = store.tool === 'hand' ? 'grab' : 'default';
    this.updateCursor();
  };

  private handleWheel = (event: WheelEvent): void => {
    if (!store.page) return;
    event.preventDefault();
    const screen = this.screenPoint(event);
    const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0018));
    this.zoomAt(store.zoom * factor, screen.x, screen.y);
  };

  private updateCursor(): void {
    if (!this.canvas) return;
    if (!store.page) {
      this.canvas.style.cursor = 'default';
      return;
    }
    if (this.interaction?.mode === 'pan') {
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    if (this.spaceDown || store.tool === 'hand') {
      this.canvas.style.cursor = 'grab';
      return;
    }
    if (store.tool !== 'select') {
      this.canvas.style.cursor = 'crosshair';
      return;
    }
    this.canvas.style.cursor = this.hoverCursor;
  }

  deleteSelected(): boolean {
    const page = this.page;
    if (!page || !this.selectedId) return false;
    const index = page.annotations.findIndex((a) => a.id === this.selectedId);
    if (index === -1) return false;
    page.annotations.splice(index, 1);
    this.selectedId = null;
    store.commit();
    return true;
  }

  clearSelection(): void {
    this.selectedId = null;
    this.scheduleRender();
  }
}

function handlePoints(rect: { x: number; y: number; w: number; h: number }) {
  const { x, y, w, h } = rect;
  return [
    { handle: 'nw' as Handle, x, y },
    { handle: 'n' as Handle, x: x + w / 2, y },
    { handle: 'ne' as Handle, x: x + w, y },
    { handle: 'e' as Handle, x: x + w, y: y + h / 2 },
    { handle: 'se' as Handle, x: x + w, y: y + h },
    { handle: 's' as Handle, x: x + w / 2, y: y + h },
    { handle: 'sw' as Handle, x, y: y + h },
    { handle: 'w' as Handle, x, y: y + h / 2 },
  ];
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}
