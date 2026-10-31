import { icon } from '../utils/icons';

export interface ModalOptions {
  title: string;
  subtitle?: string;
  body: string;
  footer?: string;
  width?: string;
}

export interface ModalHandle {
  dialog: HTMLDialogElement;
  body: HTMLElement;
  footer: HTMLElement;
  close: () => void;
}

export function openModal(options: ModalOptions): ModalHandle {
  const { title, subtitle, body, footer = '', width = 'max-w-lg' } = options;

  const dialog = document.createElement('dialog');
  dialog.className = `relative m-auto w-[calc(100vw-1.5rem)] ${width} overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0a0f19] p-0 text-slate-200 shadow-[0_50px_140px_-40px_rgba(0,0,0,1)]`;
  dialog.innerHTML = `
    <div class="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent"></div>
    <div class="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-[18px]">
      <div class="min-w-0">
        <h2 class="font-display text-[15px] font-semibold tracking-[-0.01em] text-white">${title}</h2>
        ${subtitle ? `<p class="mt-1 text-[11px] leading-relaxed text-slate-500">${subtitle}</p>` : ''}
      </div>
      <button type="button" data-close class="icon-btn -mr-1 -mt-1 h-8 w-8 shrink-0" aria-label="Close dialog">
        ${icon('x', 'h-4 w-4')}
      </button>
    </div>
    <div data-body class="max-h-[72dvh] overflow-y-auto px-5 py-4">${body}</div>
    <div data-footer class="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.07] bg-white/[0.015] px-5 py-3 ${footer ? '' : 'hidden'}">${footer}</div>
  `;

  document.body.appendChild(dialog);

  const close = () => dialog.close();
  dialog.querySelector('[data-close]')?.addEventListener('click', close);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('close', () => {
    window.setTimeout(() => dialog.remove(), 0);
  });
  dialog.showModal();

  return {
    dialog,
    body: dialog.querySelector<HTMLElement>('[data-body]')!,
    footer: dialog.querySelector<HTMLElement>('[data-footer]')!,
    close,
  };
}
