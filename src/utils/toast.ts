import { escapeHtml } from './dom';
import { icon, type IconName } from './icons';

type Variant = 'success' | 'error' | 'info';

const styles: Record<Variant, string> = {
  success:
    'border-emerald-400/25 bg-[#071612]/90 text-emerald-50 shadow-[0_24px_60px_-24px_rgba(16,185,129,0.55)]',
  error:
    'border-rose-400/25 bg-[#1a0a10]/90 text-rose-50 shadow-[0_24px_60px_-24px_rgba(244,63,94,0.5)]',
  info: 'border-white/10 bg-[#0a0f19]/95 text-slate-100 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]',
};

const glyphs: Record<Variant, IconName> = {
  success: 'check',
  error: 'alert',
  info: 'info',
};

const glyphColor: Record<Variant, string> = {
  success: 'text-emerald-300',
  error: 'text-rose-300',
  info: 'text-sky-300',
};

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export function toast(
  message: string,
  variant: Variant = 'info',
  timeout = 4600,
  action?: ToastAction,
): void {
  let root = document.getElementById('toasts');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toasts';
    root.className =
      'pointer-events-none fixed bottom-4 left-1/2 z-[90] flex w-[min(92vw,440px)] -translate-x-1/2 flex-col gap-2 sm:bottom-6';
    document.body.appendChild(root);
  }

  const element = document.createElement('div');
  element.className = `pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm backdrop-blur-2xl animate-fade-up ${styles[variant]}`;
  element.setAttribute('role', 'status');
  element.innerHTML = `
    <span class="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/[0.06] ${glyphColor[variant]}">${icon(glyphs[variant], 'h-3.5 w-3.5')}</span>
    <p class="flex-1 leading-snug">${escapeHtml(message)}</p>
    ${
      action
        ? `<button type="button" data-action class="btn-quiet mt-0.5 shrink-0 px-2.5 py-1 text-[11px]">${escapeHtml(action.label)}</button>`
        : ''
    }
    <button type="button" data-dismiss class="icon-btn -mr-1 -mt-1 h-7 w-7 shrink-0" aria-label="Dismiss notification">
      ${icon('x', 'h-3.5 w-3.5')}
    </button>
  `;

  const remove = () => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(6px)';
    element.style.transition = 'opacity 180ms ease, transform 180ms ease';
    window.setTimeout(() => element.remove(), 200);
  };

  element.querySelector('[data-dismiss]')?.addEventListener('click', remove);
  element.querySelector('[data-action]')?.addEventListener('click', () => {
    remove();
    action?.onClick();
  });
  root.appendChild(element);
  if (timeout > 0) window.setTimeout(remove, timeout);
}
