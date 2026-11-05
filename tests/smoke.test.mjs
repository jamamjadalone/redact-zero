import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const RESULTS = path.join(ROOT, 'test-results');
const BASE_PATH = '/redact-zero/';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? null;
}

const chromePath = findChrome();
const skipReason = !chromePath
  ? 'Chrome/Chromium not found. Set CHROME_PATH to run the browser smoke test.'
  : !existsSync(DIST)
    ? 'dist/ is missing. Run "npm run build" first.'
    : typeof WebSocket === 'undefined'
      ? 'Node.js 22+ is required for the built-in WebSocket client.'
      : false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('end-to-end browser smoke test', { skip: skipReason, timeout: 300_000 }, async (t) => {
  t.diagnostic(`Chrome: ${chromePath}`);

  /* ---------------------------------------------------------------- */
  /* Static server for dist/                                           */
  /* ---------------------------------------------------------------- */

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);
      if (!pathname.startsWith(BASE_PATH)) {
        response.writeHead(404).end('Not found');
        return;
      }
      let relative = pathname.slice(BASE_PATH.length);
      if (!relative || relative.endsWith('/')) relative += 'index.html';
      const file = path.resolve(DIST, relative);
      if (!file.startsWith(DIST + path.sep)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const body = await readFile(file);
      response.writeHead(200, {
        'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const appUrl = `${origin}${BASE_PATH}`;

  /* ---------------------------------------------------------------- */
  /* Headless Chrome                                                   */
  /* ---------------------------------------------------------------- */

  const profile = await mkdtemp(path.join(tmpdir(), 'redactzero-profile-'));
  const downloads = await mkdtemp(path.join(tmpdir(), 'redactzero-downloads-'));
  await mkdir(RESULTS, { recursive: true });

  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-sync',
      '--no-zygote',
      '--metrics-recording-only',
      '--mute-audio',
      '--disable-gpu',
      '--force-device-scale-factor=1',
      '--window-size=1440,1000',
      '--hide-scrollbars',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let chromeLog = '';
  chrome.stdout.on('data', (chunk) => {
    chromeLog += chunk;
  });
  chrome.stderr.on('data', (chunk) => {
    chromeLog += chunk;
  });

  let socket;
  let evaluate = async () => {
    throw new Error('DevTools is not connected');
  };

  const shutdown = async () => {
    try {
      socket?.close();
    } catch {
      /* already closed */
    }
    if (chrome.pid) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        chrome.kill('SIGKILL');
      }
    }
    server.close();
    await rm(profile, { recursive: true, force: true }).catch(() => {});
    await rm(downloads, { recursive: true, force: true }).catch(() => {});
  };

  try {
    /* -------------------------------------------------------------- */
    /* CDP connection                                                 */
    /* -------------------------------------------------------------- */

    const portFile = path.join(profile, 'DevToolsActivePort');
    let devtoolsPort = 0;
    for (let attempt = 0; attempt < 300; attempt += 1) {
      if (existsSync(portFile)) {
        try {
          const [line] = (await readFile(portFile, 'utf8')).trim().split('\n');
          devtoolsPort = Number(line);
        } catch {
          // Chrome can briefly lock the file while writing it.
        }
        if (devtoolsPort) break;
      }
      await sleep(100);
    }
    assert.ok(devtoolsPort, `Chrome did not expose DevTools:\n${chromeLog.slice(-2000)}`);

    let target;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${devtoolsPort}/json/list`)).json();
        target = list.find((entry) => entry.type === 'page');
        if (target) break;
      } catch {
        /* not ready */
      }
      await sleep(100);
    }
    assert.ok(target, 'Chrome did not expose a page target');

    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });

    let nextId = 1;
    const pending = new Map();
    const requests = [];
    const failedResponses = [];
    const consoleErrors = [];
    const dialogs = [];

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      switch (message.method) {
        case 'Network.requestWillBeSent':
          requests.push(message.params.request.url);
          break;
        case 'Network.responseReceived':
          if (message.params.response.status >= 400) {
            failedResponses.push(`${message.params.response.status} ${message.params.response.url}`);
          }
          break;
        case 'Page.javascriptDialogOpening':
          dialogs.push(message.params.type);
          void send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
          break;
        case 'Runtime.exceptionThrown':
          consoleErrors.push(
            message.params.exceptionDetails.exception?.description ??
              message.params.exceptionDetails.text,
          );
          break;
        case 'Log.entryAdded':
          if (message.params.entry.level === 'error') consoleErrors.push(message.params.entry.text);
          break;
        default:
          break;
      }
    });

    const send = (method, params = {}) => {
      const id = nextId;
      nextId += 1;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    };

    evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      });
      if (result.exceptionDetails) {
        throw new Error(
          result.exceptionDetails.exception?.description ?? result.exceptionDetails.text,
        );
      }
      return result.result.value;
    };

    const waitFor = async (expression, label, timeout = 20_000) => {
      const started = Date.now();
      let lastError;
      while (Date.now() - started < timeout) {
        try {
          if (await evaluate(expression)) return true;
        } catch (error) {
          lastError = error;
        }
        await sleep(120);
      }
      throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
    };

    const click = (selector) =>
      evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`);

    const text = (selector) =>
      evaluate(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? ''`);

    const waitForDownload = async (extension, timeout = 40_000) => {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        const names = (await readdir(downloads)).filter((name) => name.endsWith(extension));
        for (const name of names) {
          const info = await stat(path.join(downloads, name));
          if (info.size > 10_000) return { name, size: info.size };
        }
        await sleep(200);
      }
      throw new Error(`no ${extension} download appeared in ${timeout}ms`);
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Log.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloads,
      eventsEnabled: false,
    }).catch(() => send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads }));

    /* -------------------------------------------------------------- */
    /* 1. Boot and security posture                                    */
    /* -------------------------------------------------------------- */

    await send('Page.navigate', { url: appUrl });
    await waitFor('document.readyState === "complete"', 'document load');
    await waitFor('!!document.getElementById("empty-demo")', 'app mount');

    const boot = await evaluate(`(() => {
      const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content ?? '';
      return {
        title: document.title,
        lang: document.documentElement.lang,
        csp,
        h1: document.querySelectorAll('h1').length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        buttons: [...document.querySelectorAll('button')].filter((button) => button.offsetWidth).length,
      };
    })()`);

    assert.equal(boot.title, 'RedactZero — Zero-Knowledge Document Redactor');
    assert.equal(boot.lang, 'en');
    assert.equal(boot.h1, 1, 'the page should expose exactly one h1');
    assert.match(boot.csp, /default-src 'self'/);
    assert.match(boot.csp, /connect-src 'self'/);
    assert.equal(boot.overflow, 0, 'desktop layout must not scroll horizontally');
    assert.ok(boot.buttons > 15, 'expected the full toolbar and sidebar controls');
    t.diagnostic(`boot ok (${boot.buttons} visible buttons, CSP enforced)`);

    /* -------------------------------------------------------------- */
    /* 2. Demo document, tools, drawing, undo/redo                     */
    /* -------------------------------------------------------------- */

    await click('#empty-demo');
    await waitFor('document.body.innerText.includes("1440×900px")', 'demo document loaded');

    const painted = `(() => {
      const canvas = document.getElementById('editor-canvas');
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let i = 3; i < data.length; i += 64) if (data[i]) count += 1;
      return count;
    })()`;
    await waitFor(`${painted} > 500`, 'canvas pixels rendered');
    assert.ok((await evaluate(painted)) > 500);

    await click('[data-tool="pixelate"]');
    await waitFor(
      `document.querySelector('[data-tool="pixelate"]').getAttribute('aria-pressed') === 'true'`,
      'pixelate tool selected',
    );
    await click('[data-tool="blackout"]');
    await waitFor(
      `document.querySelector('[data-tool="blackout"]').getAttribute('aria-pressed') === 'true'`,
      'blackout tool selected',
    );

    const drag = await evaluate(`(() => {
      const canvas = document.getElementById('editor-canvas');
      const rect = canvas.getBoundingClientRect();
      const padding = rect.width < 640 ? 20 : 48;
      const zoom = Math.min((rect.width - padding * 2) / 1440, (rect.height - padding * 2) / 900);
      const offsetX = (rect.width - 1440 * zoom) / 2;
      const offsetY = (rect.height - 900 * zoom) / 2;
      const point = (x, y) => ({ x: rect.left + offsetX + x * zoom, y: rect.top + offsetY + y * zoom });
      return { start: point(420, 378), end: point(910, 444) };
    })()`);

    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      ...drag.start,
      button: 'none',
      buttons: 0,
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...drag.start,
      button: 'left',
      buttons: 1,
      clickCount: 1,
    });
    for (let step = 1; step <= 8; step += 1) {
      await send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: drag.start.x + ((drag.end.x - drag.start.x) * step) / 8,
        y: drag.start.y + ((drag.end.y - drag.start.y) * step) / 8,
        button: 'left',
        buttons: 1,
      });
      await sleep(20);
    }
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...drag.end,
      button: 'left',
      buttons: 0,
      clickCount: 1,
    });

    await waitFor('document.body.innerText.includes("1 redaction")', 'redaction recorded');
    assert.equal(await evaluate(`document.getElementById('undo-btn').disabled`), false);

    await click('#undo-btn');
    await waitFor('document.body.innerText.includes("0 redactions")', 'undo');
    await click('#redo-btn');
    await waitFor('document.body.innerText.includes("1 redaction")', 'redo');
    assert.match(await text('#file-strip'), /1 redaction/);
    t.diagnostic('draw + undo/redo ok');

    /* -------------------------------------------------------------- */
    /* 3. Export: flattened PNG and PDF, metadata scrub               */
    /* -------------------------------------------------------------- */

    await click('#export-btn');
    await waitFor('!!document.querySelector("[data-export]")', 'export dialog');
    assert.deepEqual(
      await evaluate(
        `[...document.querySelectorAll('[data-format]')].map((button) => button.dataset.format)`,
      ),
      ['pdf', 'png', 'jpeg'],
    );
    assert.equal(await text('#sum-pages'), '1');
    assert.equal(await text('#sum-redactions'), '1');

    await click('[data-format="png"]');
    await click('[data-export]');
    await waitFor(
      `document.getElementById('result')?.innerText.includes('Metadata scrub verified')`,
      'PNG export and metadata scan',
      45_000,
    );
    const pngResult = await text('#result');
    assert.match(pngResult, /0 bytes uploaded/);
    assert.match(pngResult, /Metadata scrub verified/);
    const png = await waitForDownload('.png');
    assert.match(png.name, /^Demo-ID-card-redacted-\d{8}-\d{4}\.png$/);

    await click('[data-format="pdf"]');
    await click('[data-export]');
    await waitFor(
      `document.getElementById('progress-label')?.textContent === 'Complete'`,
      'PDF export',
      60_000,
    );
    await waitFor(
      `document.getElementById('result')?.innerText.includes('Metadata scrub verified')`,
      'PDF metadata scan',
      20_000,
    );
    const pdf = await waitForDownload('.pdf');
    assert.match(pdf.name, /^Demo-ID-card-redacted-\d{8}-\d{4}\.pdf$/);
    t.diagnostic(`exports ok (PNG ${Math.round(png.size / 1024)} KB, PDF ${Math.round(pdf.size / 1024)} KB)`);

    await click('[data-cancel]');
    await waitFor('!document.querySelector("dialog[open]")', 'export dialog closed');

    /* -------------------------------------------------------------- */
    /* 4. Isolation dialog reports zero outbound attempts             */
    /* -------------------------------------------------------------- */

    await click('#verify-btn');
    await waitFor('!!document.getElementById("isolation-counter")', 'isolation dialog');
    assert.equal(await text('#isolation-counter'), '0');

    const displayedCsp = await evaluate(
      `document.querySelector('dialog[open] pre')?.textContent.trim() ?? ''`,
    );
    assert.equal(displayedCsp, boot.csp, 'the dialog must show the enforced CSP verbatim');
    await click('[data-done]');
    await waitFor('!document.querySelector("dialog[open]")', 'isolation dialog closed');
    t.diagnostic('network tripwire at 0 and CSP shown verbatim');

    /* -------------------------------------------------------------- */
    /* 4b. Close-document flow and unsaved-work guard                 */
    /* -------------------------------------------------------------- */

    assert.equal(
      await evaluate(`document.getElementById('close-btn').offsetWidth > 0`),
      true,
      'the close-document button should be visible once a document is open',
    );
    await click('#close-btn');
    await waitFor('!!document.querySelector("dialog[open] [data-confirm]")', 'close confirmation');
    await click('dialog[open] [data-cancel]');
    await waitFor('!document.querySelector("dialog[open]")', 'close cancelled');
    assert.match(await text('#file-strip'), /1 redaction/);

    const guarded = await evaluate(`(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    })()`);
    assert.equal(guarded, true, 'unsaved redactions must guard against closing the tab');
    t.diagnostic('close confirmation + unsaved-work guard ok');

    /* -------------------------------------------------------------- */
    /* 5. Zero third-party traffic, zero console errors               */
    /* -------------------------------------------------------------- */

    const external = [...new Set(requests)].filter(
      (url) => !url.startsWith(`${origin}${BASE_PATH}`) && !url.startsWith('data:') && !url.startsWith('blob:'),
    );
    assert.deepEqual(external, [], 'the app must only request its own origin');
    assert.deepEqual(failedResponses, [], 'no app asset may fail to load');
    assert.deepEqual(consoleErrors, [], 'the page must boot and run without console errors');
    t.diagnostic(`${requests.length} requests, all same-origin; no console errors`);

    /* -------------------------------------------------------------- */
    /* 6. Service worker + offline reload                             */
    /* -------------------------------------------------------------- */

    await evaluate('navigator.serviceWorker.ready.then(() => true)');
    await send('Page.reload', { ignoreCache: false });
    await waitFor('!!document.getElementById("empty-demo")', 'controlled reload');
    await waitFor('!!navigator.serviceWorker.controller', 'service worker control');

    await send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    await send('Page.reload', { ignoreCache: false });
    await waitFor('document.readyState === "complete"', 'offline load');
    await waitFor('!!document.getElementById("empty-demo")', 'offline app mount');

    const offline = await evaluate(`({
      title: document.title,
      online: navigator.onLine,
      demo: !!document.getElementById('empty-demo'),
      pill: document.getElementById('isolation-pill')?.innerText ?? '',
    })`);
    assert.equal(offline.demo, true);
    assert.equal(offline.online, false, 'navigator.onLine should report offline');
    assert.match(offline.pill.toLowerCase(), /offline/);

    await click('#empty-demo');
    await waitFor('document.body.innerText.includes("1440×900px")', 'offline demo render');
    t.diagnostic('offline reload and local rendering ok');

    await send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });

    /* -------------------------------------------------------------- */
    /* 7. Close document, then HEIC guidance                          */
    /* -------------------------------------------------------------- */

    await click('#close-btn');
    await waitFor('!!document.querySelector("dialog[open] [data-confirm]")', 'close confirmation');
    await click('dialog[open] [data-confirm]');
    await waitFor('!!document.getElementById("empty-demo")', 'empty state restored');
    assert.equal(
      await evaluate(`document.getElementById('close-btn').offsetWidth > 0`),
      false,
      'the close-document button must disappear when no document is open',
    );
    assert.equal(await evaluate(`document.getElementById('export-btn').disabled`), true);
    t.diagnostic('close document returns to the empty state');

    await evaluate(`(() => {
      const file = new File([new Uint8Array([0, 0, 0, 0])], 'photo.heic', { type: 'image/heic' });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      window.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }));
    })()`);
    await waitFor(
      `(document.getElementById('toasts')?.innerText ?? '').includes('HEIC')`,
      'HEIC guidance toast',
    );
    t.diagnostic('HEIC photos get a specific, actionable message');
  } catch (error) {
    try {
      const shot = await send?.('Page.captureScreenshot', { format: 'png', fromSurface: true });
      if (shot?.data) {
        await mkdir(RESULTS, { recursive: true });
        await writeFile(path.join(RESULTS, 'smoke-failure.png'), Buffer.from(shot.data, 'base64'));
      }
    } catch {
      /* page may be gone */
    }
    const tail = chromeLog.slice(-1500);
    throw new Error(`${error.message}\n\nChrome log tail:\n${tail}`, { cause: error });
  } finally {
    await shutdown();
  }
});
