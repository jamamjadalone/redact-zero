import { store } from '../state';
import type { Tool } from '../types';
import { icon, type IconName } from '../utils/icons';
import type { CanvasEditor } from './CanvasEditor';
import { openModal } from './Modal';

interface ToolSpec {
  tool: Tool;
  label: string;
  glyph: IconName;
  shortcut: string;
  danger?: boolean;
}

const TOOLS: ToolSpec[] = [
  { tool: 'select', label: 'Select & resize', glyph: 'select', shortcut: 'V' },
  { tool: 'blackout', label: 'Solid blackout box', glyph: 'square', shortcut: 'B', danger: true },
  { tool: 'pixelate', label: 'Pixelate / mosaic', glyph: 'grid', shortcut: 'P', danger: true },
  { tool: 'whiteout', label: 'Sanitizing whiteout', glyph: 'eraser', shortcut: 'W', danger: true },
  { tool: 'hand', label: 'Pan canvas', glyph: 'hand', shortcut: 'H' },
];

export function createToolBar(editor: CanvasEditor): HTMLElement {
  const bar = document.createElement('div');
  bar.className =
    'relative z-20 m-2 flex shrink-0 items-center gap-1 overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#080d16]/80 px-2 py-1.5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.9)] backdrop-blur-xl scrollbar-none lg:m-3 lg:mr-0 lg:h-[calc(100%-1.5rem)] lg:w-[60px] lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:py-2.5';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Redaction tools');

  bar.innerHTML = `
    <div class="flex items-center gap-1 lg:flex-col lg:gap-1.5">
      <span class="hidden select-none font-mono text-[8px] uppercase tracking-[0.2em] text-slate-600 lg:mb-0.5 lg:block">Tools</span>
      ${TOOLS.map(
        (spec) => `
        <button type="button" class="tool-btn" data-tool="${spec.tool}" data-danger="${spec.danger ? 'true' : 'false'}" aria-pressed="false" title="${spec.label} (${spec.shortcut})" aria-label="${spec.label}">
          ${icon(spec.glyph, 'h-[18px] w-[18px]')}
          <span class="pointer-events-none absolute bottom-0.5 right-1 font-mono text-[8px] text-slate-500">${spec.shortcut}</span>
        </button>`,
      ).join('')}
    </div>

    <div class="mx-1 h-7 w-px shrink-0 bg-white/10 lg:mx-0 lg:my-1 lg:h-px lg:w-7"></div>

    <div class="flex items-center gap-0.5 lg:flex-col lg:gap-1">
      <button type="button" id="undo-btn" class="icon-btn" title="Undo (Ctrl+Z)" aria-label="Undo" disabled>${icon('undo', 'h-4 w-4')}</button>
      <button type="button" id="redo-btn" class="icon-btn" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled>${icon('redo', 'h-4 w-4')}</button>
      <button type="button" id="clear-btn" class="icon-btn hover:text-rose-300" title="Clear all redactions" aria-label="Clear all redactions" disabled>${icon('trash', 'h-4 w-4')}</button>
    </div>

    <div class="mx-1 h-7 w-px shrink-0 bg-white/10 lg:hidden"></div>
    <div class="hidden lg:block lg:flex-1"></div>

    <div class="flex shrink-0 items-center gap-0.5 rounded-xl border border-white/[0.05] bg-white/[0.02] px-0.5 py-0.5 lg:mt-auto lg:flex-col lg:gap-1 lg:rounded-2xl lg:border-white/[0.06] lg:px-0 lg:py-1">
      <button type="button" id="zoom-out-btn" class="icon-btn" title="Zoom out (−)" aria-label="Zoom out">${icon('zoomOut', 'h-4 w-4')}</button>
      <button type="button" id="zoom-label" class="h-8 min-w-[52px] rounded-lg px-1 font-mono text-[11px] text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200" title="Fit to screen (0)">100%</button>
      <button type="button" id="zoom-in-btn" class="icon-btn" title="Zoom in (+)" aria-label="Zoom in">${icon('zoomIn', 'h-4 w-4')}</button>
      <button type="button" id="fit-btn" class="icon-btn" title="Fit to screen (0)" aria-label="Fit to screen">${icon('fit', 'h-4 w-4')}</button>
    </div>
  `;

  const toolButtons = Array.from(bar.querySelectorAll<HTMLButtonElement>('[data-tool]'));
  const undoButton = bar.querySelector<HTMLButtonElement>('#undo-btn')!;
  const redoButton = bar.querySelector<HTMLButtonElement>('#redo-btn')!;
  const clearButton = bar.querySelector<HTMLButtonElement>('#clear-btn')!;
  const zoomLabel = bar.querySelector<HTMLButtonElement>('#zoom-label')!;

  for (const button of toolButtons) {
    button.addEventListener('click', () => {
      store.setTool(button.dataset.tool as Tool);
    });
  }

  undoButton.addEventListener('click', () => store.undo());
  redoButton.addEventListener('click', () => store.redo());
  clearButton.addEventListener('click', () => confirmClearAll());
  bar.querySelector('#zoom-in-btn')?.addEventListener('click', () => editor.zoomBy(1.25));
  bar.querySelector('#zoom-out-btn')?.addEventListener('click', () => editor.zoomBy(0.8));
  bar.querySelector('#fit-btn')?.addEventListener('click', () => editor.fit());
  zoomLabel.addEventListener('click', () => editor.fit());

  const render = (): void => {
    for (const button of toolButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.tool === store.tool));
    }
    undoButton.disabled = !store.canUndo;
    redoButton.disabled = !store.canRedo;
    clearButton.disabled = store.annotationCount === 0;
    zoomLabel.textContent = `${Math.round(store.zoom * 100)}%`;
  };

  store.subscribe(render);
  render();

  return bar;
}

function confirmClearAll(): void {
  const count = store.annotationCount;
  if (count === 0) return;

  const modal = openModal({
    title: 'Clear every redaction?',
    subtitle: 'The original document is untouched — only your boxes are removed.',
    body: `
      <p class="text-sm leading-relaxed text-slate-300">
        This removes <strong class="text-white">${count} redaction${count === 1 ? '' : 's'}</strong>
        across <strong class="text-white">${store.pages.length} page${store.pages.length === 1 ? '' : 's'}</strong>.
        You can bring them back with <span class="kbd">Ctrl</span> <span class="kbd">Z</span>.
      </p>
    `,
    footer: `
      <button type="button" class="btn-ghost" data-cancel>Cancel</button>
      <button type="button" class="btn-danger" data-confirm>${icon('trash', 'h-4 w-4')} Clear all</button>
    `,
  });

  modal.footer.querySelector('[data-cancel]')?.addEventListener('click', modal.close);
  modal.footer.querySelector('[data-confirm]')?.addEventListener('click', () => {
    store.clearAll();
    modal.close();
  });
}
