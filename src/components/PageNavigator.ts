import { store } from '../state';
import { escapeHtml } from '../utils/dom';
import { icon } from '../utils/icons';

export function createPageNavigator(): HTMLElement {
  const bar = document.createElement('div');
  bar.className =
    'm-2 mt-2 flex shrink-0 items-center gap-2 rounded-2xl border border-white/[0.07] bg-[#080d16]/80 px-2 py-2 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:m-3 sm:mt-2 sm:px-3';
  bar.innerHTML = `
    <button type="button" id="prev-page" class="icon-btn shrink-0" title="Previous page" aria-label="Previous page" disabled>
      ${icon('chevronLeft', 'h-4 w-4')}
    </button>
    <div id="thumbs" class="flex flex-1 items-center gap-2 overflow-x-auto scrollbar-none"></div>
    <button type="button" id="next-page" class="icon-btn shrink-0" title="Next page" aria-label="Next page" disabled>
      ${icon('chevronRight', 'h-4 w-4')}
    </button>
    <span id="page-label" class="hidden shrink-0 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-slate-400 sm:inline"></span>
  `;

  const thumbs = bar.querySelector<HTMLElement>('#thumbs')!;
  const previous = bar.querySelector<HTMLButtonElement>('#prev-page')!;
  const next = bar.querySelector<HTMLButtonElement>('#next-page')!;
  const label = bar.querySelector<HTMLElement>('#page-label')!;

  previous.addEventListener('click', () => store.setActive(store.active - 1));
  next.addEventListener('click', () => store.setActive(store.active + 1));

  let signature = '';

  const renderThumbs = (): void => {
    const nextSignature = store.pages.map((page) => page.id).join(',');
    if (nextSignature !== signature) {
      signature = nextSignature;
      thumbs.innerHTML = store.pages
        .map(
          (page, index) => `
          <button type="button" class="group relative shrink-0 overflow-hidden rounded-xl border transition ${
            index === store.active
              ? 'border-emerald-400/60 shadow-[0_0_18px_-6px_rgba(52,211,153,0.7)] ring-2 ring-emerald-400/25'
              : 'border-white/10 opacity-70 hover:border-white/25 hover:opacity-100'
          }" data-page="${index}" title="${escapeHtml(page.label)}" aria-label="Go to page ${index + 1}">
            <img src="${page.thumbnail}" alt="" class="h-10 w-auto max-w-[76px] object-cover sm:h-12 sm:max-w-[84px]" />
            <span class="absolute bottom-0 right-0 rounded-tl-md bg-[#04060b]/85 px-1 py-px font-mono text-[9px] text-slate-300 backdrop-blur">${index + 1}</span>
          </button>`,
        )
        .join('');

      for (const button of Array.from(thumbs.querySelectorAll<HTMLButtonElement>('[data-page]'))) {
        button.addEventListener('click', () => {
          store.setActive(Number(button.dataset.page));
        });
      }
    }

    for (const button of Array.from(thumbs.querySelectorAll<HTMLButtonElement>('[data-page]'))) {
      const active = Number(button.dataset.page) === store.active;
      button.className = `group relative shrink-0 overflow-hidden rounded-xl border transition ${
        active
          ? 'border-emerald-400/60 shadow-[0_0_18px_-6px_rgba(52,211,153,0.7)] ring-2 ring-emerald-400/25'
          : 'border-white/10 opacity-70 hover:border-white/25 hover:opacity-100'
      }`;
      button.setAttribute('aria-current', String(active));
    }

    previous.disabled = store.active <= 0;
    next.disabled = store.active >= store.pages.length - 1;
    label.textContent =
      store.pages.length > 0 ? `Page ${store.active + 1} / ${store.pages.length}` : '';
  };

  store.subscribe(renderThumbs);
  renderThumbs();

  return bar;
}
