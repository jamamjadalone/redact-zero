import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const read = (rel) => readFile(path.join(ROOT, rel), 'utf8');
const exists = (rel) => existsSync(path.join(ROOT, rel));

function attr(html, name) {
  const m = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i').exec(html);
  return m ? m[1] : null;
}

test('page title is present and within SEO length', async () => {
  const html = await read('index.html');
  const title = /<title>([^<]+)<\/title>/i.exec(html);
  assert.ok(title, '<title> is required');
  const text = title[1].trim();
  assert.ok(text.length >= 10 && text.length <= 60, `title length should be 10-60 chars, got ${text.length}`);
});

test('meta description is present and within SEO length', async () => {
  const html = await read('index.html');
  const desc = /<meta\s+name="description"\s+content="([^"]*)"/i.exec(html);
  assert.ok(desc, '<meta name="description"> is required');
  const text = desc[1].trim();
  assert.ok(text.length >= 50 && text.length <= 200, `description length should be 50-200 chars, got ${text.length}`);
});

test('html declares language and charset', async () => {
  const html = await read('index.html');
  assert.match(html, /<html[^>]*\blang="[a-z]{2}(-[a-zA-Z0-9]+)?"/i, '<html lang= is required');
  assert.match(html, /<meta\s+charset="UTF-8"\s*\/?>/i, '<meta charset="UTF-8"> is required');
});

test('viewport meta is present for mobile SEO', async () => {
  const html = await read('index.html');
  assert.match(html, /<meta\s+name="viewport"\s+content="[^"]*\bwidth=device-width[^"]*"/i, 'viewport must set width=device-width');
});

test('canonical URL matches SITE_URL', async () => {
  const html = await read('index.html');
  const canonical = /<link\s+rel="canonical"\s+href="([^"]*)"/i.exec(html);
  assert.ok(canonical, '<link rel="canonical"> is required');
  assert.equal(canonical[1], 'https://jamamjadalone.is-a.dev/redact-zero/', 'canonical must match SITE_URL');
});

test('referrer policy is set', async () => {
  const html = await read('index.html');
  assert.match(html, /<meta\s+name="referrer"\s+content="no-referrer"/i, 'referrer policy must be no-referrer');
});

test('Open Graph tags are complete', async () => {
  const html = await read('index.html');
  const required = [
    ['og:type', 'website'],
    ['og:title', 'RedactZero — Zero-Knowledge Document Redactor'],
    ['og:description', ''],
    ['og:image', 'https://jamamjadalone.is-a.dev/redact-zero/icon-512.png'],
    ['og:url', 'https://jamamjadalone.is-a.dev/redact-zero/'],
    ['og:site_name', 'RedactZero'],
    ['og:image:width', '512'],
    ['og:image:height', '512'],
    ['og:image:alt', 'RedactZero shield logo'],
  ];
  for (const [prop, value] of required) {
    const re = new RegExp(`<meta\\s+property="${prop}"\\s+content="([^"]*)"`, 'i');
    const m = re.exec(html);
    assert.ok(m, `og:${prop} is required`);
    if (value) assert.equal(m[1], value, `og:${prop} must be "${value}"`);
  }
});

test('Twitter card tags are complete', async () => {
  const html = await read('index.html');
  const required = [
    ['twitter:card', 'summary'],
    ['twitter:title', 'RedactZero — Zero-Knowledge Document Redactor'],
    ['twitter:description', ''],
    ['twitter:image', 'https://jamamjadalone.is-a.dev/redact-zero/icon-512.png'],
    ['twitter:image:alt', 'RedactZero shield logo'],
  ];
  for (const [name, value] of required) {
    const re = new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'i');
    const m = re.exec(html);
    assert.ok(m, `${name} is required`);
    if (value) assert.equal(m[1], value, `${name} must be "${value}"`);
  }
});

test('robots.txt exists and allows crawling', async () => {
  assert.ok(exists('public/robots.txt'), 'public/robots.txt is required');
  const robots = await read('public/robots.txt');
  assert.match(robots, /User-agent:\s*\*/i, 'robots.txt must address all user agents');
});

test('manifest.json has installable PWA fields', async () => {
  const manifest = JSON.parse(await read('public/manifest.json'));
  assert.ok(manifest.name && manifest.name.length > 0, 'manifest name is required');
  assert.equal(manifest.short_name, 'RedactZero');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.id, '/redact-zero/');
  assert.equal(manifest.lang, 'en');
  assert.ok(manifest.description.length > 40);
  assert.ok(manifest.theme_color);
  assert.ok(manifest.background_color);
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'), 'maskable icon is required');
});

test('content images referenced in HTML exist and have alt text', async () => {
  const html = await read('index.html');
  const images = [...html.matchAll(/<img[^>]*src="([^"]+)"[^>]*>/gi)];
  for (const [full, src] of images) {
    const alt = /alt="([^"]*)"/i.exec(full);
    assert.ok(alt && alt[1].trim().length > 0, `image ${src} must have alt text`);
    if (!src.startsWith('http') && !src.startsWith('data:')) {
      assert.ok(exists(src.replace(/^\//, '')), `image ${src} must exist`);
    }
  }
});

test('internal links use relative paths', async () => {
  const html = await read('index.html');
  const links = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>/gi)];
  for (const [, href] of links) {
    if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    assert.ok(href.startsWith('./') || href.startsWith('/') || href.startsWith('#'), `internal link ${href} should be relative`);
  }
});

test('build output preserves SEO meta tags', async () => {
  if (!existsSync(DIST)) return;
  const html = await read('dist/index.html');
  assert.match(html, /<title>RedactZero/);
  assert.match(html, /name="description"/);
  assert.match(html, /property="og:url"/);
  assert.match(html, /name="twitter:card"/);
  assert.match(html, /canonical/);
});
