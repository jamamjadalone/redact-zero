import { store } from '../state';
import type { ExportFormat, ExportResult } from '../types';
import { downloadBlob, escapeHtml, formatBytes } from '../utils/dom';
import { exportDocument } from '../utils/exporter';
import { icon, type IconName } from '../utils/icons';
import { toast } from '../utils/toast';
import { openModal } from './Modal';

interface FormatSpec {
  format: ExportFormat;
  title: string;
  detail: string;
  glyph: IconName;
}

const FORMATS: FormatSpec[] = [
  { format: 'pdf', title: 'PDF', detail: 'All pages · flattened', glyph: 'file' },
  { format: 'png', title: 'PNG', detail: 'Lossless · current page', glyph: 'image' },
  { format: 'jpeg', title: 'JPEG', detail: 'Smaller · current page', glyph: 'image' },
];

export function openExportDialog(): void {
  const page = store.page;
  if (!page) {
    toast('Open a document before exporting.', 'info');
    return;
  }

  const defaultFormat: ExportFormat = store.pages.length > 1 ? 'pdf' : 'png';
  let format: ExportFormat = defaultFormat;
  let quality = 92;
  let busy = false;
  let result: ExportResult | null = null;

  const modal = openModal({
    title: 'Export a flattened document',
    subtitle: 'Redactions, watermark and pixels are baked together. Metadata is scrubbed on the way out.',
    width: 'max-w-xl',
    body: `
      <div class="space-y-5">
        <div>
          <div class="field-label mb-2"><span>Format</span><span id="scope-note" class="field-value"></span></div>
          <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Export format">
            ${FORMATS.map(
              (spec) => `
              <button type="button" data-format="${spec.format}" role="radio" aria-checked="false" data-active="false" class="format-card group">
                <span class="flex items-center justify-between gap-2">
                  <span class="format-glyph grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 transition">
                    ${icon(spec.glyph, 'h-4 w-4')}
                  </span>
                  <span class="format-check">${icon('check', 'h-3 w-3')}</span>
                </span>
                <span class="mt-3 block text-sm font-semibold text-slate-100">${spec.title}</span>
                <span class="mt-0.5 block text-[10px] leading-snug text-slate-500">${spec.detail}</span>
              </button>`,
            ).join('')}
          </div>
        </div>

        <div id="quality-wrap">
          <div class="field-label"><label for="export-quality">JPEG quality</label><span id="quality-value" class="field-value">92%</span></div>
          <input id="export-quality" type="range" min="40" max="100" step="1" value="92" class="mt-2" />
          <p class="mt-1.5 text-[10px] text-slate-500">Lower quality means a smaller file. Redactions stay fully opaque either way.</p>
        </div>

        <dl class="grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 text-[11px] sm:grid-cols-4">
          <div class="rounded-xl bg-black/20 px-2.5 py-2"><dt class="text-[9px] uppercase tracking-[0.12em] text-slate-500">Pages</dt><dd id="sum-pages" class="mt-1 font-mono text-slate-200">—</dd></div>
          <div class="rounded-xl bg-black/20 px-2.5 py-2"><dt class="text-[9px] uppercase tracking-[0.12em] text-slate-500">Resolution</dt><dd id="sum-res" class="mt-1 font-mono text-slate-200">—</dd></div>
          <div class="rounded-xl bg-black/20 px-2.5 py-2"><dt class="text-[9px] uppercase tracking-[0.12em] text-slate-500">Redactions</dt><dd id="sum-redactions" class="mt-1 font-mono text-emerald-300">—</dd></div>
          <div class="rounded-xl bg-black/20 px-2.5 py-2"><dt class="text-[9px] uppercase tracking-[0.12em] text-slate-500">Watermark</dt><dd id="sum-watermark" class="mt-1 font-mono text-slate-200">—</dd></div>
        </dl>

        <div class="flex items-start gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.05] p-3 text-[11px] leading-relaxed text-emerald-100/80">
          <span class="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300">${icon('lock', 'h-3.5 w-3.5')}</span>
          <p>Everything happens in this tab. The file is re-encoded from raw canvas pixels, scanned for surviving metadata, then handed straight to your download folder. <strong class="font-medium text-emerald-100">0 bytes are uploaded.</strong></p>
        </div>

        <div id="progress" class="hidden">
          <div class="flex items-center justify-between text-[11px] text-slate-400">
            <span id="progress-label">Preparing…</span>
            <span id="progress-pct" class="font-mono">0%</span>
          </div>
          <div class="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08] ring-1 ring-white/[0.04]">
            <div id="progress-bar" class="h-full w-0 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 shadow-[0_0_14px_rgba(52,211,153,0.7)] transition-[width] duration-200"></div>
          </div>
        </div>

        <div id="result" class="hidden"></div>
      </div>
    `,
    footer: `
      <button type="button" class="btn-ghost" data-cancel>Close</button>
      <button type="button" class="btn-primary" data-export>${icon('download', 'h-4 w-4')} Export locally</button>
    `,
  });

  const formatButtons = Array.from(modal.body.querySelectorAll<HTMLButtonElement>('[data-format]'));
  const qualityWrap = modal.body.querySelector<HTMLElement>('#quality-wrap')!;
  const qualityInput = modal.body.querySelector<HTMLInputElement>('#export-quality')!;
  const qualityValue = modal.body.querySelector<HTMLElement>('#quality-value')!;
  const scopeNote = modal.body.querySelector<HTMLElement>('#scope-note')!;
  const sumPages = modal.body.querySelector<HTMLElement>('#sum-pages')!;
  const sumRes = modal.body.querySelector<HTMLElement>('#sum-res')!;
  const sumRedactions = modal.body.querySelector<HTMLElement>('#sum-redactions')!;
  const sumWatermark = modal.body.querySelector<HTMLElement>('#sum-watermark')!;
  const progress = modal.body.querySelector<HTMLElement>('#progress')!;
  const progressLabel = modal.body.querySelector<HTMLElement>('#progress-label')!;
  const progressPct = modal.body.querySelector<HTMLElement>('#progress-pct')!;
  const progressBar = modal.body.querySelector<HTMLElement>('#progress-bar')!;
  const resultPanel = modal.body.querySelector<HTMLElement>('#result')!;
  const exportButton = modal.footer.querySelector<HTMLButtonElement>('[data-export]')!;
  const cancelButton = modal.footer.querySelector<HTMLButtonElement>('[data-cancel]')!;

  const refresh = (): void => {
    for (const button of formatButtons) {
      const active = button.dataset.format === format;
      button.setAttribute('aria-checked', String(active));
      button.dataset.active = String(active);
    }

    qualityWrap.classList.toggle('hidden', format !== 'jpeg');
    scopeNote.textContent = format === 'pdf' ? 'Every page' : 'Current page';
    sumPages.textContent =
      format === 'pdf' ? String(store.pages.length) : '1';
    sumRes.textContent = `${page.width}×${page.height}`;
    sumRedactions.textContent = String(
      format === 'pdf' ? store.annotationCount : page.annotations.length,
    );
    sumWatermark.textContent = store.watermark.enabled ? 'On' : 'Off';
  };

  for (const button of formatButtons) {
    button.addEventListener('click', () => {
      format = button.dataset.format as ExportFormat;
      refresh();
    });
  }

  qualityInput.addEventListener('input', () => {
    quality = Number(qualityInput.value);
    qualityValue.textContent = `${quality}%`;
  });

  cancelButton.addEventListener('click', () => modal.close());

  const renderResult = (output: ExportResult): void => {
    resultPanel.classList.remove('hidden');
    const scan = output.scan;
    const findings = scan.findings
      .map((finding) => `<li>${escapeHtml(finding)}</li>`)
      .join('');
    const checked = scan.checked.length
      ? scan.checked.map((item) => escapeHtml(item)).join(' · ')
      : 'byte-level scan';

    resultPanel.innerHTML = `
      <div class="animate-fade-up overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-b from-emerald-400/[0.09] to-emerald-400/[0.03]">
        <div class="flex items-start gap-3 p-3.5">
          <span class="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-400 text-emerald-950 shadow-[0_0_22px_-6px_rgba(52,211,153,0.9)]">${icon('check', 'h-4 w-4')}</span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-emerald-50">Flattened &amp; downloaded</p>
            <p class="mt-0.5 truncate font-mono text-[11px] text-emerald-200/70">${escapeHtml(output.filename)}</p>
            <p class="mt-1.5 text-[11px] text-emerald-100/60">${formatBytes(output.blob.size)} · ${output.pageCount} page${output.pageCount === 1 ? '' : 's'} · 0 bytes uploaded</p>
          </div>
          <button type="button" data-again class="btn-ghost shrink-0 px-2.5 py-1.5 text-[11px]">Download again</button>
        </div>
        <div class="border-t border-emerald-400/15 bg-black/15 px-3.5 py-3 text-[11px] leading-relaxed">
          ${
            scan.clean
              ? `<p class="flex items-center gap-1.5 font-medium text-emerald-200">${icon('shieldCheck', 'h-3.5 w-3.5')} Metadata scrub verified — no EXIF, GPS, XMP or text chunks in the output.</p>`
              : `<p class="flex items-center gap-1.5 font-medium text-amber-200">${icon('alert', 'h-3.5 w-3.5')} Residual metadata markers found:</p>
                 <ul class="mt-1 list-disc space-y-0.5 pl-5 text-amber-100/80">${findings}</ul>`
          }
          <p class="mt-1.5 font-mono text-[10px] text-emerald-100/35">Checked: ${checked}</p>
        </div>
      </div>
    `;

    resultPanel
      .querySelector<HTMLButtonElement>('[data-again]')
      ?.addEventListener('click', () => {
        if (result) downloadBlob(result.blob, result.filename);
      });
  };

  exportButton.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    exportButton.disabled = true;
    cancelButton.disabled = true;
    resultPanel.classList.add('hidden');
    progress.classList.remove('hidden');
    progressLabel.textContent = 'Preparing…';
    progressPct.textContent = '0%';
    progressBar.style.width = '0%';

    const pages = format === 'pdf' ? store.pages : [page];

    try {
      const output = await exportDocument(
        {
          pages,
          format,
          quality: format === 'jpeg' ? quality / 100 : 0.92,
          watermark: store.watermark,
          baseName: store.fileName,
        },
        (label, fraction) => {
          progressLabel.textContent = label;
          const percent = Math.round(fraction * 100);
          progressPct.textContent = `${percent}%`;
          progressBar.style.width = `${percent}%`;
        },
      );

      result = output;
      downloadBlob(output.blob, output.filename);
      renderResult(output);
      toast('Export complete — the file never left your device.', 'success');
      progressLabel.textContent = 'Complete';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed.';
      progressLabel.textContent = message;
      toast(message, 'error');
    } finally {
      busy = false;
      exportButton.disabled = false;
      cancelButton.disabled = false;
    }
  });

  refresh();
}
