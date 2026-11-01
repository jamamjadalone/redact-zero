import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git', 'test-results', '.vite', 'dev-dist']);
const BINARY = /\.(png|jpe?g|webp|ico|woff2?|ttf|otf|mp4|webm|zip|gz)$/i;

const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));

const read = (rel) => readFile(path.join(ROOT, rel), 'utf8');
const exists = (rel) => existsSync(path.join(ROOT, rel));

async function walk(rel, filter = () => true) {
  const files = [];
  const entries = await readdir(path.join(ROOT, rel), { withFileTypes: true });
  for (const entry of entries) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) files.push(...(await walk(childRel, filter)));
    } else if (filter(childRel)) {
      files.push(childRel);
    }
  }
  return files;
}

async function textSources() {
  const files = await walk('src', (file) => file.endsWith('.ts'));
  const map = new Map();
  for (const file of files) map.set(file, await read(file));
  return map;
}

function pngSize(buffer) {
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', 'expected a PNG signature');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function parseCsp(html) {
  const match = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i.exec(html);
  assert.ok(match, 'index.html must declare a Content-Security-Policy meta tag');
  const directives = new Map();
  for (const part of match[1].split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length) directives.set(tokens[0].toLowerCase(), tokens.slice(1));
  }
  return { policy: match[1], directives };
}

/* ------------------------------------------------------------------ */
/* Structure                                                           */
/* ------------------------------------------------------------------ */

test('repository has the expected structure', async () => {
  const required = [
    'index.html',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vite.config.ts',
    'tailwind.config.js',
    'postcss.config.js',
    'README.md',
    'LICENSE',
    '.gitignore',
    '.github/workflows/deploy.yml',
    '.github/workflows/quality.yml',
    'public/manifest.json',
    'public/favicon.svg',
    'public/robots.txt',
    'public/icon-192.png',
    'public/icon-512.png',
    'public/icon-maskable-512.png',
    'public/apple-touch-icon.png',
    'scripts/generate-icons.mjs',
    'src/main.ts',
    'src/app.ts',
    'src/style.css',
    'src/config.ts',
    'src/components/Header.ts',
    'src/components/CanvasEditor.ts',
    'src/components/ToolBar.ts',
    'src/components/WatermarkControls.ts',
    'src/components/PageNavigator.ts',
    'src/components/ExportModal.ts',
    'src/components/IsolationModal.ts',
    'src/utils/canvasRenderer.ts',
    'src/utils/pdfHandler.ts',
    'src/utils/watermarkGenerator.ts',
    'src/utils/exifCleaner.ts',
    'src/utils/exporter.ts',
    'src/utils/networkGuard.ts',
    'tests/repo-quality.test.mjs',
    'tests/smoke.test.mjs',
    'docs/screenshot.png',
    'docs/screenshot-empty.png',
    'docs/screenshot-export.png',
    'docs/screenshot-offline.png',
  ];
  const missing = required.filter((file) => !exists(file));
  assert.deepEqual(missing, [], `missing required files: ${missing.join(', ')}`);
});

/* ------------------------------------------------------------------ */
/* package.json                                                        */
/* ------------------------------------------------------------------ */

test('package.json is minimal, honest and wired for tests', () => {
  assert.equal(pkg.name, 'redact-zero');
  assert.equal(pkg.private, true);
  assert.equal(pkg.license, 'MIT');
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.equal(pkg.homepage, 'https://jamamjadalone.github.io/redact-zero/');
  assert.equal(pkg.repository.url, 'git+https://github.com/jamamjadalone/redact-zero.git');

  for (const script of ['dev', 'build', 'preview', 'pretest', 'test', 'test:repo', 'test:smoke']) {
    assert.equal(typeof pkg.scripts[script], 'string', `missing npm script: ${script}`);
  }
  assert.equal(pkg.scripts.pretest, 'npm run build');
  assert.match(pkg.scripts.test, /node --test/);
  assert.match(pkg.scripts.build, /tsc --noEmit/);

  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['pdf-lib', 'pdfjs-dist']);
  for (const dev of ['typescript', 'vite', 'vite-plugin-pwa', 'tailwindcss']) {
    assert.ok(pkg.devDependencies[dev], `missing devDependency: ${dev}`);
  }
  assert.equal(pkg.engines.node, '>=20');
});

test('no tracking dependencies or install hooks', () => {
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  const banned = [
    'analytics',
    'amplitude',
    'bugsnag',
    'datadog',
    'firebase',
    'fullstory',
    'google-analytics',
    'gtag',
    'hotjar',
    'matomo',
    'mixpanel',
    'newrelic',
    'plausible',
    'posthog',
    'segment',
    'sentry',
  ];
  const offenders = Object.keys(all).filter((name) =>
    banned.some((needle) => name.toLowerCase().includes(needle)),
  );
  assert.deepEqual(offenders, [], `telemetry packages are not allowed: ${offenders.join(', ')}`);

  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare']) {
    assert.equal(pkg.scripts[hook], undefined, `lifecycle hook "${hook}" is not allowed`);
  }
});

test('lockfile resolves only from the public npm registry', async () => {
  const lock = JSON.parse(await read('package-lock.json'));
  assert.equal(lock.lockfileVersion, 3);
  const hosts = new Set();
  for (const entry of Object.values(lock.packages)) {
    if (entry.resolved) hosts.add(new URL(entry.resolved).host);
  }
  assert.deepEqual([...hosts], ['registry.npmjs.org']);
});

/* ------------------------------------------------------------------ */
/* Security invariants                                                 */
/* ------------------------------------------------------------------ */

test('index.html enforces a strict Content-Security-Policy', async () => {
  const html = await read('index.html');
  const { directives } = parseCsp(html);

  assert.deepEqual(directives.get('default-src'), ["'self'"]);
  assert.deepEqual(directives.get('connect-src'), ["'self'"]);
  assert.deepEqual(directives.get('object-src'), ["'none'"]);
  assert.deepEqual(directives.get('base-uri'), ["'self'"]);
  assert.deepEqual(directives.get('form-action'), ["'none'"]);

  const scriptSrc = directives.get('script-src') ?? [];
  assert.ok(scriptSrc.includes("'self'"), 'script-src must allow self');
  assert.ok(!scriptSrc.includes("'unsafe-inline'"), 'script-src must not allow inline scripts');
  assert.ok(!scriptSrc.includes("'unsafe-eval'"), 'script-src must not allow eval');

  const workerSrc = directives.get('worker-src') ?? [];
  assert.ok(workerSrc.includes("'self'"), 'worker-src must allow self');
  const imgSrc = directives.get('img-src') ?? [];
  assert.ok(imgSrc.includes('data:') && imgSrc.includes('blob:'), 'img-src must allow local blobs');

  assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), false, 'inline <script> blocks are not allowed');
  assert.equal(/(?:src|href)="(?:https?:)?\/\//i.test(html), false, 'index.html must not load remote resources');
  assert.match(html, /<meta name="referrer" content="no-referrer"\s*\/?>/i);
});

test('application source performs no network I/O', async () => {
  const sources = await textSources();
  const offenders = [];
  const patterns = [
    ['fetch()', /\bfetch\s*\(/],
    ['new XMLHttpRequest', /\bnew\s+XMLHttpRequest\b/],
    ['XMLHttpRequest.prototype', /\bXMLHttpRequest\.prototype\b/],
    ['.sendBeacon()', /\.sendBeacon\s*\(/],
    ['new WebSocket', /\bnew\s+WebSocket\b/],
    ['new EventSource', /\bnew\s+EventSource\b/],
  ];

  for (const [file, code] of sources) {
    if (file.endsWith('utils/networkGuard.ts')) continue;
    for (const [label, pattern] of patterns) {
      if (pattern.test(code)) offenders.push(`${file} uses ${label}`);
    }
  }
  assert.deepEqual(offenders, []);

  const remote = [];
  for (const [file, code] of sources) {
    for (const match of code.matchAll(/https?:\/\/[^\s'"`)]+/g)) remote.push([file, match[0]]);
  }
  const outsideConfig = remote.filter(([file]) => file !== 'src/config.ts');
  assert.deepEqual(outsideConfig, [], 'remote URLs must live in src/config.ts');
  assert.equal(remote.length, 2, 'expected exactly the repository and site URLs in src/config.ts');
});

test('no eval and no debug leftovers in src', async () => {
  const sources = await textSources();
  for (const [file, code] of sources) {
    assert.equal(/\beval\s*\(/.test(code), false, `${file} uses eval()`);
    assert.equal(/\bnew\s+Function\s*\(/.test(code), false, `${file} uses new Function()`);
    assert.equal(/console\.(log|debug|warn|error)\s*\(/.test(code), false, `${file} logs to the console`);
    assert.equal(/\bdebugger\b/.test(code), false, `${file} contains a debugger statement`);
    assert.equal(/TODO|FIXME/.test(code), false, `${file} contains a TODO/FIXME`);
  }
});

/* ------------------------------------------------------------------ */
/* PWA                                                                 */
/* ------------------------------------------------------------------ */

test('PWA manifest and icons are installable', async () => {
  const manifest = JSON.parse(await read('public/manifest.json'));
  assert.equal(manifest.short_name, 'RedactZero');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.id, '/redact-zero/');
  assert.equal(manifest.lang, 'en');
  assert.ok(manifest.description.length > 40);

  for (const icon of manifest.icons) {
    assert.ok(exists(`public/${icon.src}`), `missing icon file: ${icon.src}`);
    const size = pngSize(await readFile(path.join(ROOT, 'public', icon.src)));
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.deepEqual(size, { width, height }, `${icon.src} does not match its declared size`);
  }
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));

  for (const shortcut of manifest.shortcuts) {
    assert.match(shortcut.url, /^\.\/\?action=(open|verify)$/);
  }
});

test('HTML head and social metadata are complete', async () => {
  const html = await read('index.html');
  assert.match(html, /<html lang="en"/);
  assert.match(html, /<meta charset="UTF-8"\s*\/?>/);
  assert.match(html, /name="viewport"[^>]*width=device-width/);
  assert.match(html, /<title>RedactZero — Zero-Knowledge Document Redactor<\/title>/);

  const description = /<meta\s+name="description"\s+content="([^"]+)"/i.exec(html)?.[1] ?? '';
  assert.ok(description.length > 80 && description.length < 320, 'meta description length is off');

  assert.match(html, /<link rel="manifest" href="manifest.json"\s*\/?>/);
  assert.match(html, /<link rel="apple-touch-icon" href="apple-touch-icon.png"\s*\/?>/);
  assert.match(html, /<meta property="og:title"/);
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/jamamjadalone\.is-a\.dev\/redact-zero\/icon-512\.png"/,
  );
  assert.match(html, /<meta property="og:image:width" content="512"/);
  assert.match(html, /<meta property="og:image:height" content="512"/);
  assert.match(
    html,
    /<meta property="og:url" content="https:\/\/jamamjadalone\.is-a\.dev\/redact-zero\/"/,
  );
  assert.match(html, /<meta name="twitter:card"/);
  assert.match(
    html,
    /<meta name="twitter:image" content="https:\/\/jamamjadalone\.is-a\.dev\/redact-zero\/icon-512\.png"/,
  );

  const touch = pngSize(await readFile(path.join(ROOT, 'public/apple-touch-icon.png')));
  assert.deepEqual(touch, { width: 180, height: 180 });

  const robots = await read('public/robots.txt');
  assert.match(robots, /User-agent:\s*\*/i);
});

test('version, site URL and theme colors agree', async () => {
  const config = await read('src/config.ts');
  const version = /APP_VERSION\s*=\s*'([^']+)'/.exec(config)?.[1];
  const siteUrl = /SITE_URL\s*=\s*'([^']+)'/.exec(config)?.[1];
  const repoUrl = /REPO_URL\s*=\s*'([^']+)'/.exec(config)?.[1];

  assert.equal(version, pkg.version);
  assert.equal(siteUrl, pkg.homepage);
  assert.equal(repoUrl, 'https://github.com/jamamjadalone/redact-zero');

  const html = await read('index.html');
  const themeColor = /<meta name="theme-color" content="([^"]+)"/i.exec(html)?.[1];
  const manifest = JSON.parse(await read('public/manifest.json'));
  assert.equal(manifest.theme_color, themeColor);
  assert.equal(manifest.background_color, themeColor);
});

/* ------------------------------------------------------------------ */
/* Docs and hygiene                                                    */
/* ------------------------------------------------------------------ */

test('README, license and screenshots are present and linked', async () => {
  const readme = await read('README.md');
  for (const section of [
    '# RedactZero',
    'Why RedactZero?',
    'Features',
    'Security model',
    'Progressive Web App',
    'Deploy to GitHub Pages',
    'Legal & privacy disclaimer',
    'License',
  ]) {
    assert.ok(readme.includes(section), `README is missing section: ${section}`);
  }
  for (const phrase of ['npm install', 'npm run dev', 'npm run build', 'GDPR', 'MIT License']) {
    assert.ok(readme.includes(phrase), `README is missing: ${phrase}`);
  }
  assert.ok(readme.includes('https://jamamjadalone.github.io/redact-zero/'));
  assert.match(readme, /actions\/workflows\/quality\.yml\/badge\.svg/);

  const images = [...readme.matchAll(/docs\/[\w.-]+\.png/g)].map((match) => match[0]);
  assert.ok(images.length >= 3, 'README should showcase the app screenshots');
  for (const image of new Set(images)) {
    assert.ok(exists(image), `README references a missing image: ${image}`);
  }

  const license = await read('LICENSE');
  assert.match(license, /MIT License/);
  assert.match(license, /2026 jamamjadalone/);
});

test('no secrets or oversized files are committed', async () => {
  const files = await walk('', (file) => !BINARY.test(file));
  const patterns = [
    /gh[pousr]_[A-Za-z0-9]{20,}/,
    /github_pat_[A-Za-z0-9_]{20,}/,
    /AKIA[0-9A-Z]{16}/,
    /AIza[0-9A-Za-z_-]{35}/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /xox[baprs]-[A-Za-z0-9-]{10,}/,
  ];

  const leaks = [];
  const oversized = [];
  for (const file of files) {
    const info = await stat(path.join(ROOT, file));
    if (info.size > 2 * 1024 * 1024) oversized.push(`${file} (${Math.round(info.size / 1024)} KB)`);
    let content;
    try {
      content = await read(file);
    } catch {
      continue;
    }
    for (const pattern of patterns) {
      if (pattern.test(content)) leaks.push(`${file} matches ${pattern}`);
    }
  }
  assert.deepEqual(leaks, []);
  assert.deepEqual(oversized, [], 'keep repository files under 2 MB');
});

/* ------------------------------------------------------------------ */
/* Build output                                                        */
/* ------------------------------------------------------------------ */

test(
  'production build is self-contained and within budget',
  { skip: existsSync(DIST) ? false : 'dist/ is missing — run npm run build first' },
  async () => {
    const html = await read('dist/index.html');
    const { directives } = parseCsp(html);
    assert.deepEqual(directives.get('connect-src'), ["'self'"]);

    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
    for (const ref of refs) {
      if (/^(?:https?:|data:|blob:|#|mailto:)/.test(ref)) continue;
      const clean = ref.replace(/^\.\//, '').replace(/^\/redact-zero\//, '');
      assert.ok(exists(`dist/${clean}`), `dist/index.html references a missing asset: ${ref}`);
    }
    assert.equal(/(?:src|href)="(?:https?:)?\/\//i.test(html), false);

    const files = await walk('dist');
    assert.equal(files.some((file) => file.endsWith('.map')), false, 'source maps must not ship');
    assert.ok(exists('dist/sw.js'), 'service worker is missing');
    assert.ok(exists('dist/manifest.json'), 'manifest is missing from the build');

    const sourceManifest = JSON.parse(await read('public/manifest.json'));
    const builtManifest = JSON.parse(await read('dist/manifest.json'));
    assert.deepEqual(builtManifest, sourceManifest);

    const sw = await read('dist/sw.js');
    assert.match(sw, /pdf\.worker/);
    assert.match(sw, /index\.html/);
    const precached = (sw.match(/revision/g) ?? []).length;
    assert.ok(precached >= 15, `expected at least 15 precached assets, found ${precached}`);

    let total = 0;
    for (const file of files) total += (await stat(path.join(ROOT, file))).size;
    assert.ok(total < 4 * 1024 * 1024, `dist/ is ${(total / 1024 / 1024).toFixed(2)} MB (budget 4 MB)`);

    const assets = await readdir(path.join(DIST, 'assets'));
    const entry = assets.filter((file) => /^index-.*\.js$/.test(file)).sort().pop();
    assert.ok(entry, 'main JS entry is missing');
    const entrySize = (await stat(path.join(DIST, 'assets', entry))).size;
    assert.ok(entrySize < 600 * 1024, `main JS is ${(entrySize / 1024).toFixed(0)} KB (budget 600 KB)`);

    const css = assets.find((file) => file.endsWith('.css'));
    const cssSize = (await stat(path.join(DIST, 'assets', css))).size;
    assert.ok(cssSize < 90 * 1024, `CSS is ${(cssSize / 1024).toFixed(0)} KB (budget 90 KB)`);

    const worker = assets.find((file) => file.startsWith('pdf.worker') && file.endsWith('.mjs'));
    assert.ok(worker, 'pdf.js worker must be bundled for offline PDF support');
    assert.ok((await stat(path.join(DIST, 'assets', worker))).size > 1024 * 1024);
  },
);

/* ------------------------------------------------------------------ */
/* UI contract + tooling                                               */
/* ------------------------------------------------------------------ */

test('stable UI ids used by the smoke test exist', async () => {
  const sources = await textSources();
  const all = [...sources.values()].join('\n');
  const ids = [
    'editor-canvas',
    'file-strip',
    'empty-open',
    'empty-demo',
    'open-btn',
    'export-btn',
    'close-btn',
    'verify-btn',
    'isolation-pill',
    'isolation-counter',
    'undo-btn',
    'redo-btn',
    'clear-btn',
    'zoom-label',
    'page-label',
    'wm-toggle',
    'export-quality',
    'result',
  ];
  const missing = ids.filter(
    (id) => !all.includes(`id="${id}"`) && !all.includes(`'${id}'`) && !all.includes(`#${id}`),
  );
  assert.deepEqual(missing, [], `missing UI ids: ${missing.join(', ')}`);

  assert.match(all, /data-format/);
  assert.match(all, /data-export/);
  assert.match(all, /data-tool/);
});

test('TypeScript and PostCSS configuration are strict', async () => {
  const tsconfig = JSON.parse(await read('tsconfig.json').then((text) => text.replace(/^\s*\/\/.*$/gm, '')));
  assert.equal(tsconfig.compilerOptions.strict, true);
  assert.equal(tsconfig.compilerOptions.noUnusedLocals, true);
  assert.equal(tsconfig.compilerOptions.noUnusedParameters, true);
  assert.equal(tsconfig.compilerOptions.noEmit, true);

  const postcss = await read('postcss.config.js');
  assert.match(postcss, /tailwindcss/);
  assert.match(postcss, /autoprefixer/);
});

test('CI workflows run the quality gates', async () => {
  const quality = await read('.github/workflows/quality.yml');
  assert.match(quality, /pull_request/);
  assert.match(quality, /npm ci/);
  assert.match(quality, /npm test/);
  assert.match(quality, /actions\/setup-node/);

  const deploy = await read('.github/workflows/deploy.yml');
  assert.match(deploy, /npm test/);
  assert.match(deploy, /actions\/upload-pages-artifact/);
  assert.match(deploy, /actions\/deploy-pages/);
  assert.match(deploy, /pages:\s*write/);
  assert.match(deploy, /id-token:\s*write/);
});
