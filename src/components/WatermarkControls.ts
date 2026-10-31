import { buildPreset, store } from '../state';
import { icon } from '../utils/icons';

const SWATCHES = ['#dc2626', '#0f172a', '#1d4ed8', '#047857', '#7c3aed'];

export function createWatermarkControls(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'panel p-4';
  section.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
          ${icon('layers', 'h-4 w-4')}
        </span>
        <div>
          <h2 class="font-display text-[13px] font-semibold tracking-[-0.01em] text-white">Anti-fraud watermark</h2>
          <p class="mt-0.5 text-[11px] leading-relaxed text-slate-500">Tiled diagonally and baked into every exported pixel.</p>
        </div>
      </div>
      <button type="button" id="wm-toggle" role="switch" aria-checked="true" aria-label="Enable anti-fraud watermark" class="switch mt-0.5"></button>
    </div>

    <div id="wm-body" class="mt-4 space-y-4 transition-opacity">
      <div>
        <div class="field-label"><label for="wm-text">Watermark text</label><span id="wm-count" class="field-value">0/120</span></div>
        <textarea id="wm-text" rows="2" maxlength="120" class="input mt-1.5 resize-none leading-relaxed" placeholder="FOR VERIFICATION ONLY — RECIPIENT — DATE"></textarea>
      </div>

      <div>
        <label class="field-label" for="wm-recipient">Recipient / company</label>
        <input id="wm-recipient" maxlength="40" class="input mt-1.5" placeholder="e.g. Acme Bank" autocomplete="off" />
        <div class="mt-2 grid gap-1.5">
          <button type="button" class="chip-preset" data-preset="1">FOR VERIFICATION ONLY — [RECIPIENT] — [DATE]</button>
          <button type="button" class="chip-preset" data-preset="2">SUBMITTED TO [COMPANY] FOR KYC — DO NOT REUSE</button>
        </div>
      </div>

      <div class="space-y-3 rounded-xl border border-white/[0.05] bg-black/20 p-3">
        <div>
          <div class="field-label"><label for="wm-angle">Tiling angle</label><span id="wm-angle-value" class="field-value">-35°</span></div>
          <input id="wm-angle" type="range" min="-90" max="90" step="1" value="-35" class="mt-2.5" />
        </div>
        <div>
          <div class="field-label"><label for="wm-opacity">Opacity</label><span id="wm-opacity-value" class="field-value">25%</span></div>
          <input id="wm-opacity" type="range" min="5" max="90" step="1" value="25" class="mt-2.5" />
        </div>
        <div>
          <div class="field-label"><label for="wm-size">Font size</label><span id="wm-size-value" class="field-value">34 px</span></div>
          <input id="wm-size" type="range" min="12" max="96" step="1" value="34" class="mt-2.5" />
        </div>
        <div>
          <div class="field-label"><label for="wm-density">Density</label><span id="wm-density-value" class="field-value">Balanced</span></div>
          <input id="wm-density" type="range" min="1" max="5" step="1" value="3" class="mt-2.5" />
        </div>
      </div>

      <div>
        <div class="field-label"><span>Ink colour</span><span id="wm-color-value" class="field-value">#DC2626</span></div>
        <div class="mt-2 flex items-center gap-2">
          <div class="flex flex-1 items-center gap-1.5">
            ${SWATCHES.map(
              (color) => `
              <button type="button" class="h-8 w-8 rounded-xl border border-white/15 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.8)] ring-offset-2 ring-offset-[#0a0f19] transition hover:scale-105" data-color="${color}" style="background:${color}" title="${color}" aria-label="Use colour ${color}"></button>
            `,
            ).join('')}
          </div>
          <label class="relative inline-flex h-8 w-10 cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] transition hover:border-white/30 hover:bg-white/[0.07]" title="Custom colour">
            ${icon('sparkles', 'h-3.5 w-3.5 text-slate-400')}
            <input id="wm-color" type="color" value="#dc2626" class="absolute inset-0 h-full w-full opacity-0" aria-label="Custom watermark colour" />
          </label>
        </div>
      </div>

      <div class="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
        <button type="button" id="wm-reset" class="btn-quiet -ml-2 px-2 py-1.5 text-[11px]">
          ${icon('refresh', 'h-3.5 w-3.5')} Reset
        </button>
        <span class="text-[10px] text-slate-600">Burn-in preview is live</span>
      </div>
    </div>
  `;

  const toggle = section.querySelector<HTMLButtonElement>('#wm-toggle')!;
  const body = section.querySelector<HTMLElement>('#wm-body')!;
  const text = section.querySelector<HTMLTextAreaElement>('#wm-text')!;
  const count = section.querySelector<HTMLElement>('#wm-count')!;
  const recipient = section.querySelector<HTMLInputElement>('#wm-recipient')!;
  const angle = section.querySelector<HTMLInputElement>('#wm-angle')!;
  const angleValue = section.querySelector<HTMLElement>('#wm-angle-value')!;
  const opacity = section.querySelector<HTMLInputElement>('#wm-opacity')!;
  const opacityValue = section.querySelector<HTMLElement>('#wm-opacity-value')!;
  const size = section.querySelector<HTMLInputElement>('#wm-size')!;
  const sizeValue = section.querySelector<HTMLElement>('#wm-size-value')!;
  const density = section.querySelector<HTMLInputElement>('#wm-density')!;
  const densityValue = section.querySelector<HTMLElement>('#wm-density-value')!;
  const colorInput = section.querySelector<HTMLInputElement>('#wm-color')!;
  const colorValue = section.querySelector<HTMLElement>('#wm-color-value')!;
  const swatches = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-color]'));

  const densityLabels = ['Sparse', 'Light', 'Balanced', 'Dense', 'Maximum'];

  const updateCount = (): void => {
    count.textContent = `${text.value.length}/120`;
  };

  const sync = (): void => {
    const wm = store.watermark;
    toggle.setAttribute('aria-checked', String(wm.enabled));
    body.classList.toggle('opacity-40', !wm.enabled);

    if (document.activeElement !== text) text.value = wm.text;
    if (document.activeElement !== recipient) recipient.value = wm.recipient;

    angle.value = String(wm.angle);
    angleValue.textContent = `${wm.angle}°`;
    opacity.value = String(Math.round(wm.opacity * 100));
    opacityValue.textContent = `${Math.round(wm.opacity * 100)}%`;
    size.value = String(wm.fontSize);
    sizeValue.textContent = `${wm.fontSize} px`;
    density.value = String(wm.density);
    densityValue.textContent = densityLabels[wm.density - 1] ?? 'Balanced';
    colorInput.value = wm.color;
    colorValue.textContent = wm.color.toUpperCase();

    for (const swatch of swatches) {
      const active = swatch.dataset.color?.toLowerCase() === wm.color.toLowerCase();
      swatch.classList.toggle('ring-2', active);
      swatch.classList.toggle('ring-emerald-400', active);
      swatch.classList.toggle('ring-offset-2', active);
    }
    updateCount();
  };

  toggle.addEventListener('click', () => {
    store.updateWatermark({ enabled: !store.watermark.enabled });
  });

  text.addEventListener('input', () => {
    store.updateWatermark({ text: text.value });
    updateCount();
  });

  recipient.addEventListener('input', () => {
    store.updateWatermark({ recipient: recipient.value });
  });

  for (const preset of Array.from(section.querySelectorAll<HTMLButtonElement>('[data-preset]'))) {
    preset.addEventListener('click', () => {
      const kind = preset.dataset.preset === '1' ? 1 : 2;
      const next = buildPreset(kind, store.watermark.recipient);
      store.updateWatermark({ text: next, enabled: true });
      text.value = next;
      updateCount();
      text.focus();
    });
  }

  angle.addEventListener('input', () => {
    store.updateWatermark({ angle: Number(angle.value) });
  });
  opacity.addEventListener('input', () => {
    store.updateWatermark({ opacity: Number(opacity.value) / 100 });
  });
  size.addEventListener('input', () => {
    store.updateWatermark({ fontSize: Number(size.value) });
  });
  density.addEventListener('input', () => {
    store.updateWatermark({ density: Number(density.value) });
  });
  colorInput.addEventListener('input', () => {
    store.updateWatermark({ color: colorInput.value });
  });
  for (const swatch of swatches) {
    swatch.addEventListener('click', () => {
      const color = swatch.dataset.color;
      if (color) store.updateWatermark({ color });
    });
  }

  section.querySelector('#wm-reset')?.addEventListener('click', () => {
    store.updateWatermark({
      text: buildPreset(1, store.watermark.recipient),
      angle: -35,
      opacity: 0.25,
      fontSize: 34,
      color: '#dc2626',
      density: 3,
      enabled: true,
    });
    sync();
  });

  store.subscribe(sync);
  sync();

  return section;
}

export function createGuaranteesCard(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'panel p-4';
  section.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
        ${icon('shieldCheck', 'h-4 w-4')}
      </span>
      <div>
        <h2 class="font-display text-[13px] font-semibold tracking-[-0.01em] text-white">What gets destroyed</h2>
        <p class="mt-0.5 text-[11px] text-slate-500">Baked into every exported pixel.</p>
      </div>
    </div>
    <ul class="mt-3 space-y-2">
      <li class="flex gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5 text-[11px] leading-relaxed text-slate-400">
        <span class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-emerald-400/10 text-emerald-300">${icon('check', 'h-3 w-3')}</span>
        <span><strong class="font-medium text-slate-200">EXIF, GPS &amp; device tags</strong> — re-encoded from canvas pixels, never copied from the source.</span>
      </li>
      <li class="flex gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5 text-[11px] leading-relaxed text-slate-400">
        <span class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-emerald-400/10 text-emerald-300">${icon('check', 'h-3 w-3')}</span>
        <span><strong class="font-medium text-slate-200">Editable layers</strong> — redactions are flattened, so no PDF inspector can drag a box away.</span>
      </li>
      <li class="flex gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5 text-[11px] leading-relaxed text-slate-400">
        <span class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-emerald-400/10 text-emerald-300">${icon('check', 'h-3 w-3')}</span>
        <span><strong class="font-medium text-slate-200">Cloud &amp; telemetry</strong> — no backend, no analytics, and a CSP that blocks outbound connections.</span>
      </li>
    </ul>
    <div class="mt-3 rounded-xl border border-white/[0.05] bg-black/20 p-3">
      <h3 class="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Shortcuts</h3>
      <div class="mt-2 grid grid-cols-2 gap-y-1.5 text-[11px] text-slate-500">
        <span>Select</span><span class="text-right"><span class="kbd">V</span></span>
        <span>Blackout</span><span class="text-right"><span class="kbd">B</span></span>
        <span>Pixelate</span><span class="text-right"><span class="kbd">P</span></span>
        <span>Whiteout</span><span class="text-right"><span class="kbd">W</span></span>
        <span>Undo</span><span class="text-right"><span class="kbd">Ctrl</span> <span class="kbd">Z</span></span>
        <span>Redo</span><span class="text-right"><span class="kbd">Ctrl</span> <span class="kbd">Y</span></span>
        <span>Fit screen</span><span class="text-right"><span class="kbd">0</span></span>
        <span>Pan</span><span class="text-right"><span class="kbd">Space</span></span>
      </div>
    </div>
  `;
  return section;
}
