import { CanvasEditor } from './components/CanvasEditor';
import { openExportDialog } from './components/ExportModal';
import { createHeader } from './components/Header';
import { openIsolationDialog } from './components/IsolationModal';
import { openModal } from './components/Modal';
import { createPageNavigator } from './components/PageNavigator';
import { createToolBar } from './components/ToolBar';
import { createGuaranteesCard, createWatermarkControls } from './components/WatermarkControls';
import { store } from './state';
import type { PageData } from './types';
import { createDemoPage } from './utils/demoDocument';
import { formatBytes } from './utils/dom';
import { icon } from './utils/icons';
import {
  imageToPage,
  isHeicFile,
  isImageFile,
  isPdfFile,
  pdfToPages,
} from './utils/pdfHandler';
import { toast } from './utils/toast';

const WARN_FILE_BYTES = 50 * 1024 * 1024;
const MAX_FILE_BYTES = 200 * 1024 * 1024;
const HEIC_MESSAGE =
  'This browser could not decode that HEIC/HEIF photo. Export it as JPEG and try again — Safari can open HEIC directly.';

export function mountApp(root: HTMLElement): void {
  root.innerHTML = '';
  root.className = 'relative flex h-[100dvh] flex-col overflow-hidden';

  const editor = new CanvasEditor();

  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept =
    'application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif,.pdf,.png,.jpg,.jpeg,.webp,.heic,.heif';
  picker.multiple = true;
  picker.hidden = true;

  const openPicker = (): void => picker.click();

  const header = createHeader({
    onOpen: openPicker,
    onExport: openExportDialog,
    onVerify: openIsolationDialog,
    onClose: confirmClose,
  });

  const main = document.createElement('main');
  main.className = 'relative z-10 flex min-h-0 flex-1 flex-col lg:flex-row';

  /* ---------------------------------------------------------------- */
  /* Canvas stage                                                      */
  /* ---------------------------------------------------------------- */

  const canvasSection = document.createElement('section');
  canvasSection.className = 'relative order-1 flex min-h-0 min-w-0 flex-1 flex-col lg:order-2';

  const canvasWrap = document.createElement('div');
  canvasWrap.className =
    'canvas-grid relative m-2 mb-0 min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/[0.07] sm:m-3 sm:mb-0';
  canvasWrap.appendChild(editor.element);

  const emptyState = document.createElement('div');
  emptyState.className =
    'absolute inset-0 z-20 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-6';
  emptyState.innerHTML = `
    <div class="relative my-auto w-full max-w-2xl animate-fade-up">
      <div class="pointer-events-none absolute -inset-x-10 -top-12 h-44 rounded-full bg-emerald-400/[0.09] blur-3xl"></div>
      <div class="panel relative overflow-hidden p-5 sm:p-7">
        <div class="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"></div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <span class="eyebrow">
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"></span>
              <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
            </span>
            Local-only workspace
          </span>
          <span class="chip !border-emerald-400/20 !bg-emerald-400/[0.07] !text-emerald-200">
            ${icon('lock', 'h-3 w-3')} 0 bytes uploaded
          </span>
        </div>

        <h1 class="mt-4 font-display text-[26px] font-semibold leading-[1.08] tracking-[-0.035em] text-white text-balance sm:text-[34px]">
          Redact anything.<br />
          <span class="bg-gradient-to-r from-slate-300 via-slate-400 to-slate-600 bg-clip-text text-transparent">Upload nothing.</span>
        </h1>
        <p class="mt-3 max-w-lg text-sm leading-relaxed text-slate-400">
          Open an ID, passport, bank statement or KYC PDF. Black it out, pixelate it, watermark it —
          every pixel stays inside this tab.
        </p>

        <div class="mt-6 grid gap-2 sm:grid-cols-[1fr_auto]">
          <button type="button" id="empty-open" class="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-3.5 py-3 text-left transition duration-150 hover:border-emerald-400/40 hover:bg-emerald-400/[0.05] sm:px-4 sm:py-3.5">
            <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition group-hover:border-emerald-400/30 group-hover:bg-emerald-400/10 group-hover:text-emerald-300">
              ${icon('upload', 'h-5 w-5')}
            </span>
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-white">Drop a file or browse</span>
              <span class="mt-0.5 block text-[11px] text-slate-500">PNG · JPEG · WebP · multi-page PDF</span>
            </span>
            <span class="ml-auto hidden shrink-0 items-center gap-1 sm:flex">
              <span class="kbd">Ctrl</span><span class="kbd">O</span>
            </span>
          </button>
          <button type="button" id="empty-demo" class="btn-ghost min-h-[62px] justify-center sm:px-4">
            ${icon('sparkles', 'h-4 w-4 text-emerald-300')} Try the demo ID
          </button>
        </div>

        <div class="mt-5 flex flex-wrap items-center gap-2">
          <span class="chip">${icon('lock', 'h-3 w-3 text-emerald-300')} 0 uploads</span>
          <span class="chip">${icon('wifiOff', 'h-3 w-3 text-emerald-300')} Works offline</span>
          <span class="chip">${icon('scan', 'h-3 w-3 text-emerald-300')} EXIF scrubbed</span>
          <span class="ml-auto hidden text-[10px] uppercase tracking-[0.16em] text-slate-600 sm:block">Drag &amp; drop anywhere</span>
        </div>
      </div>
    </div>
  `;
  canvasWrap.appendChild(emptyState);

  const watermarkBadge = document.createElement('div');
  watermarkBadge.className = 'watermark-badge hidden';
  watermarkBadge.innerHTML = `${icon('layers', 'h-3 w-3')}<span>Watermark live</span>`;
  canvasWrap.appendChild(watermarkBadge);

  const hint = document.createElement('div');
  hint.className =
    'pointer-events-none absolute bottom-3 left-3 hidden rounded-full border border-white/[0.07] bg-[#05080f]/70 px-3 py-1.5 font-mono text-[10px] text-slate-500 backdrop-blur-md md:block';
  hint.textContent = 'wheel = zoom · space = pan · esc = select';
  canvasWrap.appendChild(hint);

  const busyOverlay = document.createElement('div');
  busyOverlay.className =
    'absolute inset-0 z-30 hidden place-items-center bg-ink-950/70 p-4 backdrop-blur-sm';
  busyOverlay.innerHTML = `
    <div class="panel flex flex-col items-center gap-3 px-7 py-6 text-center">
      <div class="h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-emerald-400 shadow-[0_0_20px_-4px_rgba(52,211,153,0.9)]"></div>
      <p id="busy-text" class="max-w-xs text-sm text-slate-300">Working locally…</p>
      <p class="text-[9px] uppercase tracking-[0.22em] text-slate-600">No upload · no network</p>
    </div>
  `;
  canvasWrap.appendChild(busyOverlay);

  const dropOverlay = document.createElement('div');
  dropOverlay.id = 'drop-overlay';
  dropOverlay.className =
    'absolute inset-0 z-40 flex items-center justify-center bg-ink-950/85 p-4 backdrop-blur-sm';
  dropOverlay.innerHTML = `
    <div class="rounded-3xl border-2 border-dashed border-emerald-400/40 bg-emerald-400/[0.06] px-10 py-10 text-center shadow-[0_0_80px_-20px_rgba(52,211,153,0.55)] backdrop-blur-sm">
      <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-400/25 bg-emerald-400/15 text-emerald-300">
        ${icon('upload', 'h-6 w-6')}
      </div>
      <p class="mt-4 font-display text-lg font-semibold text-emerald-50">Release to load locally</p>
      <p class="mt-1 text-xs text-emerald-200/60">The file is read from disk into memory — nothing is sent anywhere.</p>
    </div>
  `;
  canvasWrap.appendChild(dropOverlay);

  const pageNavigator = createPageNavigator();

  canvasSection.append(canvasWrap, pageNavigator);

  const toolbar = createToolBar(editor);
  toolbar.classList.add('order-2', 'lg:order-1');

  const sidebar = document.createElement('aside');
  sidebar.className =
    'order-3 max-h-[42dvh] w-full shrink-0 space-y-3 overflow-y-auto border-t border-white/[0.06] bg-[#05080f]/60 p-3 lg:h-full lg:max-h-none lg:w-[348px] lg:border-l lg:border-t-0 lg:bg-transparent lg:p-3.5';

  const watermarkCard = createWatermarkControls();
  const guaranteesCard = createGuaranteesCard();
  sidebar.append(watermarkCard, guaranteesCard);

  main.append(toolbar, canvasSection, sidebar);
  root.append(header, main, picker);

  /* ---------------------------------------------------------------- */
  /* Loading                                                           */
  /* ---------------------------------------------------------------- */

  async function loadFiles(files: File[]): Promise<void> {
    const candidates = files.filter(
      (file) => isPdfFile(file) || isImageFile(file) || isHeicFile(file),
    );
    const oversized = candidates.filter((file) => file.size > MAX_FILE_BYTES);
    if (oversized.length) {
      toast(
        `${oversized.map((file) => file.name).join(', ')} ${
          oversized.length === 1 ? 'is' : 'are'
        } over 200 MB. Split the file first — every page is rendered in memory.`,
        'error',
      );
    }

    const supported = candidates.filter((file) => file.size <= MAX_FILE_BYTES);
    if (supported.length === 0) {
      if (oversized.length === 0) {
        toast('Unsupported file. Use PNG, JPEG, WebP or PDF.', 'error');
      }
      return;
    }

    for (const file of supported) {
      if (file.size > WARN_FILE_BYTES) {
        toast(`${file.name} is ${formatBytes(file.size)} — rendering may take a while.`, 'info');
      }
    }

    const pages: PageData[] = [];
    try {
      for (const file of supported) {
        if (isPdfFile(file)) {
          store.setBusy(`Rendering ${file.name}…`);
          const rendered = await pdfToPages(file, (done, total) => {
            store.setBusy(`Rendering page ${done} of ${total} locally…`);
          });
          pages.push(...rendered);
        } else {
          store.setBusy(`Decoding ${file.name} locally…`);
          try {
            pages.push(await imageToPage(file));
          } catch (error) {
            // HEIC is the default iPhone camera format; Chrome and Firefox cannot
            // decode it, so replace the opaque decoder error with a useful message.
            if (isHeicFile(file)) throw new Error(HEIC_MESSAGE);
            throw error;
          }
        }
      }

      if (pages.length === 0) throw new Error('No pages could be read from that file.');
      store.addPages(pages, { replace: store.pages.length === 0 });
      store.setTool('blackout');
      toast(
        `Loaded ${pages.length} page${pages.length === 1 ? '' : 's'} — still 100% local.`,
        'success',
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not read that document.';
      toast(message, 'error');
    } finally {
      store.setBusy(null);
    }
  }

  function confirmClose(): void {
    if (store.pages.length === 0) return;
    const annotations = store.annotationCount;
    const pageCount = store.pages.length;
    const pagesLabel = pageCount === 1 ? 'page' : `${pageCount} pages`;

    const modal = openModal({
      title: 'Close this document?',
      subtitle: 'Nothing is saved anywhere — RedactZero only ever holds documents in memory.',
      body: `
        <p class="text-sm leading-relaxed text-slate-300">
          ${
            annotations > 0
              ? `Your <strong class="text-white">${annotations} redaction${annotations === 1 ? '' : 's'}</strong> and the ${pagesLabel} will be discarded.`
              : `The ${pagesLabel} will be removed from this tab.`
          }
        </p>
      `,
      footer: `
        <button type="button" class="btn-ghost" data-cancel>Keep it open</button>
        <button type="button" class="btn-danger" data-confirm>${icon('x', 'h-4 w-4')} Close document</button>
      `,
    });

    modal.footer.querySelector('[data-cancel]')?.addEventListener('click', modal.close);
    modal.footer.querySelector('[data-confirm]')?.addEventListener('click', () => {
      modal.close();
      store.removeAll();
      toast('Document closed — nothing was saved.', 'info');
    });
  }

  function loadDemo(): void {
    try {
      const demo = createDemoPage();
      store.addPages([demo], { replace: store.pages.length === 0 });
      store.setTool('blackout');
      toast('Demo ID loaded — black out the ID number to see the bake-in.', 'success');
    } catch {
      toast('Could not create the demo document.', 'error');
    }
  }

  picker.addEventListener('change', () => {
    const files = Array.from(picker.files ?? []);
    picker.value = '';
    if (files.length) void loadFiles(files);
  });

  emptyState.querySelector('#empty-open')?.addEventListener('click', openPicker);
  emptyState.querySelector('#empty-demo')?.addEventListener('click', loadDemo);

  /* ---------------------------------------------------------------- */
  /* Drag & drop                                                       */
  /* ---------------------------------------------------------------- */

  let dragDepth = 0;
  const hasFiles = (event: DragEvent): boolean =>
    Array.from(event.dataTransfer?.types ?? []).includes('Files');

  window.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    document.body.classList.add('drop-active');
  });

  window.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  });

  window.addEventListener('dragleave', (event) => {
    if (!hasFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) document.body.classList.remove('drop-active');
  });

  window.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    document.body.classList.remove('drop-active');
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) void loadFiles(files);
  });

  /* ---------------------------------------------------------------- */
  /* Reactive chrome                                                   */
  /* ---------------------------------------------------------------- */

  const renderChrome = (): void => {
    const hasPages = store.pages.length > 0;
    main.dataset.empty = String(!hasPages);
    emptyState.classList.toggle('hidden', hasPages);
    pageNavigator.classList.toggle('hidden', !hasPages);
    hint.classList.toggle('hidden', !hasPages);
    watermarkBadge.classList.toggle(
      'hidden',
      !hasPages || !store.watermark.enabled || !store.watermark.text.trim(),
    );
    busyOverlay.classList.toggle('hidden', !store.busy);
    busyOverlay.classList.toggle('grid', Boolean(store.busy));
    const busyText = busyOverlay.querySelector<HTMLElement>('#busy-text');
    if (busyText && store.busy) busyText.textContent = store.busy;
  };

  store.subscribe(renderChrome);
  renderChrome();

  /* ---------------------------------------------------------------- */
  /* Unsaved-work guard                                                */
  /* ---------------------------------------------------------------- */

  window.addEventListener('beforeunload', (event) => {
    if (store.annotationCount === 0) return;
    event.preventDefault();
    // Legacy browsers require returnValue to be set for the prompt to appear.
    event.returnValue = '';
  });

  /* ---------------------------------------------------------------- */
  /* Keyboard shortcuts                                                */
  /* ---------------------------------------------------------------- */

  window.addEventListener('keydown', (event) => {
    if (isTypingTarget(event.target)) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (mod && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) store.redo();
      else store.undo();
      return;
    }
    if (mod && key === 'y') {
      event.preventDefault();
      store.redo();
      return;
    }
    if (mod && key === 'e') {
      event.preventDefault();
      if (store.pages.length) openExportDialog();
      return;
    }
    if (mod && key === 'o') {
      event.preventDefault();
      openPicker();
      return;
    }
    if (mod) return;

    switch (key) {
      case 'v':
        store.setTool('select');
        break;
      case 'b':
        store.setTool('blackout');
        break;
      case 'p':
        store.setTool('pixelate');
        break;
      case 'w':
        store.setTool('whiteout');
        break;
      case 'h':
        store.setTool('hand');
        break;
      case '0':
        editor.fit();
        break;
      case '+':
      case '=':
        editor.zoomBy(1.25);
        break;
      case '-':
        editor.zoomBy(0.8);
        break;
      case 'escape':
        store.setTool('select');
        editor.clearSelection();
        break;
      case 'delete':
      case 'backspace':
        if (editor.deleteSelected()) event.preventDefault();
        break;
      default:
        break;
    }
  });

  /* ---------------------------------------------------------------- */
  /* Deep links from the manifest shortcuts                            */
  /* ---------------------------------------------------------------- */

  const action = new URLSearchParams(window.location.search).get('action');
  if (action === 'open') openPicker();
  if (action === 'verify') openIsolationDialog();
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
