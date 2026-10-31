# RedactZero — OpenCode Production-Ready Prompt Specification

This file contains the complete, detailed, production-grade prompt designed for **OpenCode**, **Claude Code**, **Cursor**, or any advanced AI coding assistant to build the entire **RedactZero** PWA repository from scratch with zero backend dependencies.

---

## Copy-Paste Prompt for OpenCode / Coding Assistant

```markdown
You are an expert Senior Full-Stack & Systems Web Engineer specializing in client-side Web APIs, HTML5 Canvas, PDF manipulation, and offline-first Progressive Web Apps (PWAs).

Your task is to build a complete, production-ready, zero-dependency-backend PWA called "RedactZero" (Zero-Knowledge ID & KYC Document Redactor) that runs 100% in the user's browser with zero network requests.

Follow these strict step-by-step implementation instructions:

### Step 1: Project Architecture & Dependencies Setup
* **Step 1.1**: Initialize a modern Vite + TypeScript + Tailwind CSS project structure. Ensure standard, clean file organization:
  ```
  redact-zero/
  ├── public/
  │   ├── favicon.svg
  │   ├── icon-192.png
  │   ├── icon-512.png
  │   └── manifest.json
  ├── src/
  │   ├── assets/
  │   ├── components/
  │   │   ├── Header.ts
  │   │   ├── CanvasEditor.ts
  │   │   ├── ToolBar.ts
  │   │   ├── WatermarkControls.ts
  │   │   ├── PageNavigator.ts
  │   │   └── ExportModal.ts
  │   ├── utils/
  │   │   ├── canvasRenderer.ts
  │   │   ├── pdfHandler.ts
  │   │   ├── watermarkGenerator.ts
  │   │   └── exifCleaner.ts
  │   ├── app.ts
  │   ├── main.ts
  │   └── style.css
  ├── index.html
  ├── package.json
  ├── tsconfig.json
  ├── vite.config.ts
  └── README.md
  ```
* **Step 1.2**: Add the exact dependencies in `package.json`:
  * Core libraries: `pdfjs-dist` (for rendering multi-page PDFs to canvas), `pdf-lib` (for generating flattened, secure output PDFs).
  * Icons: `lucide` or inline lightweight SVGs (zero bundle bloat).
  * PWA: `vite-plugin-pwa` for zero-config offline Service Worker caching.

### Step 2: Canvas Engine & Document Ingestion
* **Step 2.1 (File Drop & Ingestion)**:
  * Support drag-and-drop or file picker for `.png`, `.jpg`, `.jpeg`, `.webp`, and multi-page `.pdf` files.
  * For image files: Load directly into an offscreen and display canvas while preserving original resolution and aspect ratio.
  * For PDF files: Use `pdfjs-dist` to render each page onto an HTML5 Canvas at high DPI (scale factor >= 2.0 for razor-sharp document clarity). Provide a bottom/side pagination bar to switch between pages.
* **Step 2.2 (Offline Status Banner)**:
  * At the top of the interface, include a dynamic security pill:
    * If `navigator.onLine` is true: Display a green badge `"100% Local Sandbox — 0 Bytes Sent to Cloud"`.
    * If offline: Display `"Airplane Mode Active — Fully Functional Offline"`.
    * Provide a toggle or button: *"Verify Isolation (DevTools Network Tip)"*.

### Step 3: Redaction & Annotation Tools
* **Step 3.1 (Drawing Interaction)**:
  * Implement mouse and touch coordinates mapping accurately to internal canvas coordinates regardless of CSS scaling or zoom levels.
  * Provide interactive controls: Zoom In/Out, Fit-to-Screen, Reset Pan, and Pan tool (Spacebar or Hand tool).
* **Step 3.2 (Redaction Modes)**:
  * Mode A: **Solid Blackout Box** (Draw rectangle to permanently obscure sensitive fields, CNIC/ID numbers, signatures).
  * Mode B: **Pixelate / Mosaic Blur** (Downsample and re-render target area grid so text cannot be OCR'd).
  * Mode C: **Sanitizing Eraser** (Whiteout box for light background documents).
* **Step 3.3 (History & Layer Management)**:
  * Implement Undo (`Ctrl+Z`), Redo (`Ctrl+Y`), and Clear All layers.
  * Maintain annotations as an editable vector state array before final bake/flattening, allowing users to resize or delete boxes before exporting.

### Step 4: Anti-Fraud Diagonal Watermark Engine
* **Step 4.1 (Watermark Customizer)**:
  * Text Input with standard quick-presets:
    * Preset 1: `"FOR VERIFICATION ONLY — [SERVICE_NAME] — [CURRENT_DATE]"`
    * Preset 2: `"SUBMITTED TO [COMPANY] FOR KYC — DO NOT REUSE"`
    * Preset 3: Custom user input text.
* **Step 4.2 (Visual Controls)**:
  * Tiling Angle slider (default: -35 degrees).
  * Opacity slider (default: 25% — readable document text while making unauthorized reuse impossible).
  * Font Size and Color picker (default: High-contrast Dark Slate / Red).
  * Density / Spacing slider (repeating diagonal pattern across the entire document canvas).

### Step 5: Metadata Stripping & Irreversible Flattening
* **Step 5.1 (Forensic Scrubbing)**:
  * Completely destroy camera EXIF, GPS location tags, device serial numbers, and creator metadata by re-encoding canvas data via `canvas.toBlob()`.
* **Step 5.2 (Anti-Reversal Rasterization)**:
  * Ensure the exported document is 100% flattened. The black redaction boxes MUST be baked into the underlying bitmap pixels so that no Acrobat or PDF inspector can select, move, or delete the black overlay to expose underlying text.
* **Step 5.3 (Export Options)**:
  * Single Page: Export as flattened PNG (lossless) or JPEG (custom quality slider).
  * Multi-page PDF: Use `pdf-lib` to stitch the sanitized canvas frames back into a clean, unlayered PDF document.

### Step 6: PWA Configuration & Offline Manifest
* **Step 6.1**: Configure `vite-plugin-pwa` in `vite.config.ts` with `registerType: 'autoUpdate'`.
* **Step 6.2**: Provide complete `manifest.json` with app name `"RedactZero"`, theme color `#0f172a`, standalone display mode, and proper icon sizes (192x192, 512x512).
* **Step 6.3**: Implement a minimal, responsive UI styled with Tailwind CSS (dark mode by default, modern cyber-minimalist theme).

### Step 7: Documentation & GitHub Polish
* **Step 7.1**: Generate a comprehensive `README.md` including:
  * High-impact Hero Header with badges (MIT License, Zero Telemetry, 100% Client-Side, Works Offline).
  * "Why RedactZero?" section explaining KYC fraud risks and cloud upload vulnerabilities.
  * Step-by-step local development instructions (`npm install`, `npm run dev`, `npm run build`).
  * GitHub Pages 1-click deployment workflow (`.github/workflows/deploy.yml`).
  * Legal & Privacy Disclaimer explicitly stating the tool is designed for personal data minimization under GDPR and global privacy standards.

Output all configuration files, code files, and assets with production-ready TypeScript code without skipping steps or leaving placeholders.
```

---

## Recommended Deployment & Launch Checklist

1. **Local Test**: Run `npm install && npm run dev` and open DevTools Network tab. Disconnect Wi-Fi and ensure document redaction and export function flawlessly.
2. **GitHub Repository**: Create repo named `redact-zero`. Add an MIT License and paste the generated `README.md`.
3. **GitHub Pages Deployment**: Enable GitHub Pages under Repository Settings -> Pages -> GitHub Actions (using the generated `.github/workflows/deploy.yml`).
4. **Community Showcase**: Post the live URL to Hacker News (`Show HN: RedactZero - Zero-knowledge in-browser document redaction & KYC watermarking`) and Reddit (`r/privacy`, `r/selfhosted`, `r/webdev`).
