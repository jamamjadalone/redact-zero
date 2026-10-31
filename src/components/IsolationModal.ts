import { icon } from '../utils/icons';
import { networkGuard } from '../utils/networkGuard';
import { toast } from '../utils/toast';
import { openModal } from './Modal';

const CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'";

export function openIsolationDialog(): void {
  const modal = openModal({
    title: 'Verify zero-network isolation',
    subtitle: 'RedactZero is a static page. Here is how to prove nothing leaves this tab.',
    width: 'max-w-xl',
    body: `
      <div class="space-y-4">
        <div class="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-b from-emerald-400/[0.09] to-transparent p-4">
          <p class="flex items-center gap-2 text-sm font-semibold text-emerald-50">
            <span class="grid h-7 w-7 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300">${icon('shieldCheck', 'h-4 w-4')}</span>
            Don't take our word for it.
          </p>
          <p class="mt-2 text-xs leading-relaxed text-emerald-100/70">
            There is no backend to receive your files. The page also ships a Content-Security-Policy
            that blocks connections to every other origin, so an accidental upload would fail loudly.
          </p>
        </div>

        <ol class="relative space-y-4 pl-9">
          <span class="absolute bottom-3 left-[11px] top-3 w-px bg-gradient-to-b from-emerald-400/40 via-white/10 to-transparent"></span>
          <li class="relative">
            <span class="absolute -left-9 top-0 grid h-[22px] w-[22px] place-items-center rounded-full border border-emerald-400/30 bg-[#0a0f19] font-mono text-[10px] font-semibold text-emerald-300">1</span>
            <p class="text-xs font-medium text-slate-100">Open DevTools → Network</p><p class="mt-0.5 text-[11px] text-slate-500">Press F12 (or ⌘⌥I) and clear the request list.</p>
          </li>
          <li class="relative">
            <span class="absolute -left-9 top-0 grid h-[22px] w-[22px] place-items-center rounded-full border border-emerald-400/30 bg-[#0a0f19] font-mono text-[10px] font-semibold text-emerald-300">2</span>
            <p class="text-xs font-medium text-slate-100">Drop a PDF or photo, draw a blackout box</p><p class="mt-0.5 text-[11px] text-slate-500">Rendering, pixelation and watermarking all run on this device.</p>
          </li>
          <li class="relative">
            <span class="absolute -left-9 top-0 grid h-[22px] w-[22px] place-items-center rounded-full border border-emerald-400/30 bg-[#0a0f19] font-mono text-[10px] font-semibold text-emerald-300">3</span>
            <p class="text-xs font-medium text-slate-100">Export and watch the list</p><p class="mt-0.5 text-[11px] text-slate-500">No upload, no analytics, no remote fonts. Just a local download.</p>
          </li>
          <li class="relative">
            <span class="absolute -left-9 top-0 grid h-[22px] w-[22px] place-items-center rounded-full border border-emerald-400/30 bg-[#0a0f19] font-mono text-[10px] font-semibold text-emerald-300">4</span>
            <p class="text-xs font-medium text-slate-100">Turn off Wi-Fi and repeat</p><p class="mt-0.5 text-[11px] text-slate-500">The service worker keeps the app fully functional offline.</p>
          </li>
        </ol>

        <div class="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5">
          <div class="flex items-center justify-between gap-3">
            <span class="text-[11px] font-medium text-slate-300">Outbound requests attempted this session</span>
            <span id="isolation-counter" class="grid h-9 min-w-[42px] place-items-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-2 font-mono text-base font-semibold text-emerald-300">0</span>
          </div>
          <p id="isolation-note" class="mt-2 text-[10px] leading-relaxed text-slate-500">
            RedactZero wraps <code class="font-mono text-slate-400">fetch</code>, <code class="font-mono text-slate-400">XMLHttpRequest</code> and
            <code class="font-mono text-slate-400">sendBeacon</code> to count any attempt to reach another origin. This counter should stay at zero forever.
          </p>
        </div>

        <div>
          <div class="flex items-center justify-between gap-3">
            <p class="field-label">Enforced Content-Security-Policy</p>
            <button type="button" data-copy-csp class="btn-quiet px-2 py-1 text-[10px]">${icon('copy', 'h-3 w-3')} Copy</button>
          </div>
          <pre class="mt-1.5 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/40 p-3 font-mono text-[10px] leading-relaxed text-slate-400">${CSP}</pre>
        </div>
      </div>
    `,
    footer: `
      <a href="https://github.com/jamamjadalone/redact-zero" target="_blank" rel="noopener noreferrer" class="btn-ghost">
        ${icon('github', 'h-4 w-4')} Read the source
      </a>
      <button type="button" class="btn-primary" data-done>Got it</button>
    `,
  });

  const counter = modal.body.querySelector<HTMLElement>('#isolation-counter')!;
  const note = modal.body.querySelector<HTMLElement>('#isolation-note')!;

  const update = (): void => {
    const count = networkGuard.count;
    counter.textContent = String(count);
    if (count > 0) {
      counter.className =
        'grid h-9 min-w-[42px] place-items-center rounded-xl border border-rose-400/25 bg-rose-400/10 px-2 font-mono text-base font-semibold text-rose-300';
      note.textContent =
        'An outbound attempt was detected and should be reported. The CSP blocks it, but this counter is expected to remain at zero.';
      note.className = 'mt-2 text-[10px] leading-relaxed text-rose-300/80';
    }
  };

  const unsubscribe = networkGuard.subscribe(update);
  modal.dialog.addEventListener('close', unsubscribe);
  modal.footer.querySelector('[data-done]')?.addEventListener('click', modal.close);

  modal.body.querySelector('[data-copy-csp]')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(CSP);
      toast('Content-Security-Policy copied to clipboard.', 'success');
    } catch {
      toast('Clipboard access was blocked by the browser.', 'error');
    }
  });

  update();
}
