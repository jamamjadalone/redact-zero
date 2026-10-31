import type { Annotation, PageData, Tool, WatermarkOptions } from './types';

export function formatLongDate(date = new Date()): string {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function buildPreset(kind: 1 | 2, recipient: string): string {
  const who = (recipient.trim() || 'Recipient').toUpperCase();
  const date = formatLongDate().toUpperCase();
  if (kind === 1) return `FOR VERIFICATION ONLY — ${who} — ${date}`;
  return `SUBMITTED TO ${who} FOR KYC — DO NOT REUSE`;
}

type Snapshot = Record<string, Annotation[]>;

const HISTORY_LIMIT = 80;

class Store {
  pages: PageData[] = [];
  active = 0;
  tool: Tool = 'blackout';
  zoom = 1;
  offsetX = 0;
  offsetY = 0;
  fitMode = true;
  fileName = '';
  busy: string | null = null;
  watermark: WatermarkOptions = {
    text: `FOR VERIFICATION ONLY — ${formatLongDate().toUpperCase()}`,
    recipient: '',
    angle: -35,
    opacity: 0.25,
    fontSize: 34,
    color: '#dc2626',
    density: 3,
    enabled: true,
  };

  private listeners = new Set<() => void>();
  private history: Snapshot[] = [];
  private historyIndex = -1;

  get page(): PageData | undefined {
    return this.pages[this.active];
  }

  get annotationCount(): number {
    return this.pages.reduce((total, page) => total + page.annotations.length, 0);
  }

  get canUndo(): boolean {
    return this.historyIndex > 0;
  }

  get canRedo(): boolean {
    return this.historyIndex >= 0 && this.historyIndex < this.history.length - 1;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(): void {
    for (const listener of this.listeners) listener();
  }

  addPages(pages: PageData[], { replace }: { replace: boolean }): void {
    if (replace || this.pages.length === 0) {
      this.pages = pages;
      this.active = 0;
      this.fileName = pages[0]?.label.split(' — page ')[0] ?? 'document';
    } else {
      this.pages = [...this.pages, ...pages];
      this.active = this.pages.length - pages.length;
    }
    this.fitMode = true;
    this.resetHistory();
    this.emit();
  }

  removeAll(): void {
    this.pages = [];
    this.active = 0;
    this.fileName = '';
    this.zoom = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.fitMode = true;
    this.resetHistory();
    this.emit();
  }

  setActive(index: number): void {
    if (index < 0 || index >= this.pages.length || index === this.active) return;
    this.active = index;
    this.fitMode = true;
    this.emit();
  }

  setTool(tool: Tool): void {
    if (this.tool === tool) return;
    this.tool = tool;
    this.emit();
  }

  setBusy(label: string | null): void {
    this.busy = label;
    this.emit();
  }

  /* ---------------------------------------------------------------- */
  /* History                                                           */
  /* ---------------------------------------------------------------- */

  private snapshot(): Snapshot {
    const snap: Snapshot = {};
    for (const page of this.pages) {
      snap[page.id] = page.annotations.map((annotation) => ({ ...annotation }));
    }
    return snap;
  }

  private restore(snap: Snapshot): void {
    for (const page of this.pages) {
      page.annotations = (snap[page.id] ?? []).map((annotation) => ({ ...annotation }));
    }
  }

  resetHistory(): void {
    this.history = [this.snapshot()];
    this.historyIndex = 0;
  }

  /** Records the current annotation state as an undoable step. */
  commit(): void {
    if (this.pages.length === 0) return;
    const snap = this.snapshot();
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(snap);
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
    this.historyIndex = this.history.length - 1;
    this.emit();
  }

  undo(): void {
    if (!this.canUndo) return;
    this.historyIndex -= 1;
    this.restore(this.history[this.historyIndex]);
    this.emit();
  }

  redo(): void {
    if (!this.canRedo) return;
    this.historyIndex += 1;
    this.restore(this.history[this.historyIndex]);
    this.emit();
  }

  clearAll(): void {
    if (this.annotationCount === 0) return;
    for (const page of this.pages) page.annotations = [];
    this.commit();
  }

  updateWatermark(patch: Partial<WatermarkOptions>): void {
    this.watermark = { ...this.watermark, ...patch };
    this.emit();
  }
}

export const store = new Store();
