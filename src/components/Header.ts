import { APP_VERSION, REPO_URL } from '../config';
import { store } from '../state';
import { escapeHtml } from '../utils/dom';
import { icon } from '../utils/icons';
import { networkGuard } from '../utils/networkGuard';

export interface HeaderActions {
  onOpen: () => void;
  onExport: () => void;
  onVerify: () => void;
}

export function createHeader(actions: HeaderActions): HTMLElement {
  const header = document.createElement('header');
  header.className =
    'relative z-30 shrink-0 border-b border-white/[0.06] bg-[#05080f]/75 backdrop-blur-2xl';
  header.innerHTML = `
    <div class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/35 to-transparent"></div>
    <div class="flex h-[60px] items-center gap-2.5 px-3 sm:px-5">
      <a href="./" class="group flex min-w-0 items-center gap-2.5 rounded-xl" aria-label="RedactZero home">
        <span class="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[13px] border border-emerald-400/25 bg-gradient-to-br from-[#0f2b26] to-[#06100d] text-emerald-300 shadow-[0_0_26px_-8px_rgba(52,211,153,0.65)] transition group-hover:border-emerald-400/45 group-hover:shadow-[0_0_32px_-6px_rgba(52,211,153,0.8)]">
          <span class="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></span>
          ${icon('shieldCheck', 'h-[18px] w-[18px]')}
        </span>
        <span class="min-w-0">
          <span class="flex items-center gap-2">
            <span class="truncate font-display text-[15px] font-semibold tracking-[-0.01em] text-white">RedactZero</span>
            <span class="hidden rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-emerald-300/80 sm:inline">v${APP_VERSION}</span>
          </span>
          <span class="hidden truncate text-[10px] uppercase tracking-[0.16em] text-slate-600 sm:block">Zero-knowledge redaction</span>
        </span>
      </a>

      <div class="ml-auto flex items-center gap-1.5 sm:gap-2">
        <button type="button" id="isolation-pill" class="group hidden items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition sm:inline-flex" aria-live="polite"></button>
        <button type="button" id="verify-btn" class="btn-ghost hidden md:inline-flex" title="Verify zero-network isolation">
          ${icon('scan', 'h-4 w-4')}
          <span class="hidden lg:inline">Verify isolation</span>
        </button>
        <button type="button" id="open-btn" class="btn-ghost" title="Open a PDF or image (Ctrl+O)">
          ${icon('upload', 'h-4 w-4')}
          <span class="hidden sm:inline">Open</span>
        </button>
        <button type="button" id="export-btn" class="btn-primary" title="Export flattened document (Ctrl+E)">
          ${icon('download', 'h-4 w-4')}
          <span class="hidden sm:inline">Export</span>
        </button>
        <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer" class="icon-btn hidden sm:inline-flex" title="View source on GitHub" aria-label="View source on GitHub">
          ${icon('github', 'h-4 w-4')}
        </a>
      </div>
    </div>
    <div id="file-strip" class="hidden items-center gap-2 border-t border-white/[0.04] bg-white/[0.012] px-3 py-1.5 text-[11px] text-slate-500 sm:px-5"></div>
  `;

  const pill = header.querySelector<HTMLButtonElement>('#isolation-pill')!;
  const fileStrip = header.querySelector<HTMLElement>('#file-strip')!;
  const exportButton = header.querySelector<HTMLButtonElement>('#export-btn')!;

  header.querySelector('#open-btn')?.addEventListener('click', actions.onOpen);
  header.querySelector('#export-btn')?.addEventListener('click', actions.onExport);
  header.querySelector('#verify-btn')?.addEventListener('click', actions.onVerify);
  pill.addEventListener('click', actions.onVerify);

  const renderPill = (): void => {
    const online = navigator.onLine;
    const outbound = networkGuard.count;

    if (!online) {
      pill.className =
        'group inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/[0.08] px-2.5 py-1.5 text-[11px] font-medium text-amber-200 shadow-[0_0_20px_-10px_rgba(251,191,36,0.7)] transition hover:bg-amber-400/15';
      pill.innerHTML = `${icon('wifiOff', 'h-3.5 w-3.5')}<span class="hidden md:inline">Airplane mode — fully offline</span><span class="md:hidden">Offline</span>`;
      pill.title = 'No network connection — RedactZero remains fully functional.';
      return;
    }

    if (outbound > 0) {
      pill.className =
        'group inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-400/[0.09] px-2.5 py-1.5 text-[11px] font-medium text-rose-200 shadow-[0_0_20px_-10px_rgba(251,113,133,0.7)] transition hover:bg-rose-400/15';
      pill.innerHTML = `${icon('alert', 'h-3.5 w-3.5')}<span>${outbound} outbound attempt${outbound === 1 ? '' : 's'}</span>`;
      pill.title = 'RedactZero attempted to reach another origin. This should never happen — click for details.';
      return;
    }

    pill.className =
      'group inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2.5 py-1.5 text-[11px] font-medium text-emerald-200 shadow-[0_0_20px_-10px_rgba(52,211,153,0.8)] transition hover:bg-emerald-400/15';
    pill.innerHTML = `<span class="relative flex h-1.5 w-1.5"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70"></span><span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"></span></span><span class="hidden md:inline">100% local · 0 bytes sent</span><span class="md:hidden">Local only</span>`;
    pill.title = '100% local sandbox — nothing is uploaded. Click to verify.';
  };

  const renderFileStrip = (): void => {
    const page = store.page;
    if (!page) {
      fileStrip.classList.add('hidden');
      fileStrip.classList.remove('flex');
      return;
    }
    const annotations = store.annotationCount;
    fileStrip.classList.remove('hidden');
    fileStrip.classList.add('flex');
    fileStrip.innerHTML = `
      <span class="inline-flex min-w-0 items-center gap-2">
        <span class="relative flex h-1.5 w-1.5 shrink-0">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50"></span>
          <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
        </span>
        ${icon(page.kind === 'pdf' ? 'file' : 'image', 'h-3.5 w-3.5 shrink-0 text-slate-500')}
        <span class="truncate font-medium text-slate-300">${escapeHtml(store.fileName)}</span>
      </span>
      <span class="text-slate-700">·</span>
      <span class="shrink-0 font-mono">${page.width}×${page.height}px</span>
      <span class="text-slate-700">·</span>
      <span class="shrink-0">${store.pages.length} page${store.pages.length === 1 ? '' : 's'}</span>
      <span class="text-slate-700">·</span>
      <span class="shrink-0 rounded-full px-1.5 ${annotations > 0 ? 'bg-emerald-400/10 text-emerald-300' : ''}">${annotations} redaction${annotations === 1 ? '' : 's'}</span>
      <span class="ml-auto hidden shrink-0 items-center gap-1.5 text-slate-500 md:inline-flex">
        ${icon('lock', 'h-3 w-3 text-emerald-400/70')} In-memory only
      </span>
    `;
  };

  store.subscribe(() => {
    renderFileStrip();
    exportButton.disabled = store.pages.length === 0;
  });
  networkGuard.subscribe(renderPill);
  window.addEventListener('online', renderPill);
  window.addEventListener('offline', renderPill);

  renderPill();
  renderFileStrip();
  exportButton.disabled = store.pages.length === 0;

  return header;
}
