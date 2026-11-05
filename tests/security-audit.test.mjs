import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const read = (rel) => readFile(path.join(ROOT, rel), 'utf8');
const exists = (rel) => existsSync(path.join(ROOT, rel));

async function walk(rel, filter = () => true) {
  const files = [];
  const entries = await readdir(path.join(ROOT, rel), { withFileTypes: true });
  for (const entry of entries) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const ignored = ['node_modules', 'dist', '.git', 'test-results', '.vite', 'dev-dist'];
      if (!ignored.includes(entry.name)) files.push(...(await walk(childRel, filter)));
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

test('no dangerous dynamic code execution in application source', async () => {
  const sources = await textSources();
  const offenders = [];
  const patterns = [
    ['eval()', /\beval\s*\(/],
    ['new Function()', /\bnew\s+Function\s*\(/],
    ['setTimeout(string)', /\bsetTimeout\s*\(\s*["'`]/],
    ['setInterval(string)', /\bsetInterval\s*\(\s*["'`]/],
    ['execScript', /\bexecScript\s*\(/],
  ];
  for (const [file, code] of sources) {
    for (const [label, pattern] of patterns) {
      if (pattern.test(code)) offenders.push(`${file} uses ${label}`);
    }
  }
  assert.deepEqual(offenders, [], 'dynamic code execution is not allowed: ' + offenders.join(', '));
});

test('no console logging left in application source', async () => {
  const sources = await textSources();
  const offenders = [];
  for (const [file, code] of sources) {
    if (/console\.(log|debug|info|warn|error)\s*\(/.test(code)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], 'console logging found in: ' + offenders.join(', '));
});

test('no javascript: URLs or data: script URLs in application source', async () => {
  const sources = await textSources();
  const offenders = [];
  for (const [file, code] of sources) {
    if (/javascript\s*:/.test(code)) offenders.push(`${file} contains javascript: URL`);
    if (/data\s*:\s*(?:text|application)\/(?:javascript|ecmascript)/i.test(code)) offenders.push(`${file} contains data: script URL`);
  }
  assert.deepEqual(offenders, []);
});

test('index.html has strict Content-Security-Policy with no unsafe-inline scripts', async () => {
  const html = await read('index.html');
  const match = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i.exec(html);
  assert.ok(match, 'CSP meta tag is required');
  const policy = match[1];
  assert.match(policy, /default-src\s+'self'/);
  assert.match(policy, /connect-src\s+'self'/);
  assert.match(policy, /object-src\s+'none'/);
  assert.match(policy, /base-uri\s+'self'/);
  assert.match(policy, /form-action\s+'none'/);
  const scriptPart = policy.split('script-src')[1]?.split(';')[0] ?? '';
  assert.ok(!/'unsafe-inline'/.test(scriptPart), 'script-src must not allow unsafe-inline');
  assert.ok(!/'unsafe-eval'/.test(policy), 'unsafe-eval must not be allowed (wasm-unsafe-eval is ok)');
  assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), false, 'no inline <script> blocks');
});

test('index.html loads no remote resources', async () => {
  const html = await read('index.html');
  const remote = html.matchAll(/(?:src|href)="(https?:)\/\/[^"]+"/gi);
  const allowed = new Set([
    'https://jamamjadalone.is-a.dev/redact-zero/icon-512.png',
    'https://jamamjadalone.is-a.dev/redact-zero/',
  ]);
  const disallowed = [...remote].map((m) => m[0].replace(/^(?:src|href)="/, '').replace(/"$/, '')).filter((u) => !allowed.has(u));
  assert.deepEqual(disallowed, [], 'index.html must not load remote resources: ' + disallowed.join(', '));
});

test('referrer policy is no-referrer', async () => {
  const html = await read('index.html');
  assert.match(html, /<meta name="referrer" content="no-referrer"\s*\/?>/i);
});

test('application source performs no network I/O outside networkGuard', async () => {
  const sources = await textSources();
  const offenders = [];
  const patterns = [
    ['fetch()', /\bfetch\s*\(/],
    ['XMLHttpRequest', /\bXMLHttpRequest\b/],
    ['sendBeacon', /\.sendBeacon\s*\(/],
    ['WebSocket', /\bnew\s+WebSocket\b/],
    ['EventSource', /\bnew\s+EventSource\b/],
  ];
  for (const [file, code] of sources) {
    if (file.endsWith('utils/networkGuard.ts')) continue;
    if (file.endsWith('components/IsolationModal.ts')) continue; // documents the guard in HTML <code> tags
    for (const [label, pattern] of patterns) {
      if (pattern.test(code)) offenders.push(`${file} uses ${label}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('network guard wraps fetch, XHR and sendBeacon', async () => {
  const code = await read('src/utils/networkGuard.ts');
  assert.ok(/\bfetch\b/.test(code), 'networkGuard must wrap fetch');
  assert.ok(/XMLHttpRequest/.test(code), 'networkGuard must wrap XMLHttpRequest');
  assert.ok(/\.sendBeacon\b/.test(code), 'networkGuard must wrap sendBeacon');
});

test('no localStorage/sessionStorage persistence of document data', async () => {
  const sources = await textSources();
  const offenders = [];
  for (const [file, code] of sources) {
    if (/(localStorage|sessionStorage)\.(getItem|setItem|removeItem|clear)\s*\(/.test(code)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], 'document data must not persist in storage: ' + offenders.join(', '));
});

test('manifest requests no dangerous permissions', async () => {
  const manifest = JSON.parse(await read('public/manifest.json'));
  const dangerous = ['notifications', 'geolocation', 'camera', 'microphone', 'backgroundSync'];
  for (const perm of dangerous) {
    assert.ok(!manifest[perm] && !manifest.permissions?.includes(perm), `manifest must not request ${perm}`);
  }
});

test('service worker exists and uses workbox caching strategies', async () => {
  assert.ok(exists('dist/sw.js'), 'service worker must exist in dist');
  const sw = await read('dist/sw.js');
  assert.ok(/workbox|precache|runtimeCaching|cacheName/.test(sw), 'SW should use workbox caching');
});

test('beforeunload guard exists for unsaved redactions', async () => {
  const code = await read('src/app.ts');
  assert.ok(/beforeunload/.test(code), 'beforeunload event listener must exist');
  assert.ok(/annotationCount/.test(code), 'guard must check annotation count');
});

test('file input accepts only safe document types', async () => {
  const code = await read('src/app.ts');
  assert.ok(/accept/.test(code), 'file input must define accept attribute');
  assert.ok(/\.pdf/i.test(code) || /application\/pdf/.test(code), 'PDF input must be allowed');
  assert.ok(/image\//.test(code), 'image input must be allowed');
});

test('PDF password failure returns a user-friendly message', async () => {
  const code = await read('src/utils/pdfHandler.ts');
  assert.ok(/password-protected/i.test(code), 'password-protected PDFs need a specific message');
  assert.ok(/PasswordException/.test(code), 'PasswordException must be caught');
});

test('TODO/FIXME markers are not committed', async () => {
  const sources = await textSources();
  const offenders = [];
  for (const [file, code] of sources) {
    if (/TODO|FIXME/.test(code)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], 'TODO/FIXME found in: ' + offenders.join(', '));
});

test('secrets are not committed', async () => {
  const files = await walk('', (file) => !/\.(png|jpe?g|webp|ico|woff2?|ttf|otf|mp4|webm|zip|gz|map)$/i.test(file));
  const patterns = [
    /gh[pousr]_[A-Za-z0-9]{20,}/,
    /github_pat_[A-Za-z0-9_]{20,}/,
    /AKIA[0-9A-Z]{16}/,
    /AIza[0-9A-Za-z_-]{35}/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /xox[baprs]-[A-Za-z0-9-]{10,}/,
  ];
  const leaks = [];
  for (const file of files) {
    let content;
    try { content = await read(file); } catch { continue; }
    for (const pattern of patterns) {
      if (pattern.test(content)) leaks.push(`${file} matches secret pattern`);
    }
  }
  assert.deepEqual(leaks, []);
});

test('unsaved-work guard prevents silent data loss on close', async () => {
  const code = await read('src/app.ts');
  assert.ok(/removeAll/.test(code), 'close document must clear all state');
  assert.ok(/annotationCount\s*===\s*0/.test(code), 'guard must only fire with unsaved work');
});
