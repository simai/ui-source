#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// A theme toggle (.sf-theme-button without data-theme) shows the theme it
// switches to: a moon on a light page, a sun on a dark one -- on an
// sf-icon-button host and on a native button's .sf-icon -- and an author's
// own glyph stays (ui-effects site, 2026-10-28). A choice (data-theme) stays a
// choice after its sf-icon-button has started and handed data-theme to the
// button it draws: before, its glyph flipped and a click toggled the theme in
// about one run of three, whenever the host started before the read.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const page = (lang) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body>
<sf-icon-button id="host" class="sf-theme-button" aria-label="Тёмная тема"></sf-icon-button>
<button id="native" type="button" class="sf-theme-button" aria-label="Тёмная тема"><i class="sf-icon" aria-hidden="true">dark_mode</i></button>
<sf-icon-button id="own" class="sf-theme-button" icon="palette" aria-label="Тема"></sf-icon-button>
<sf-icon-button id="choice" class="sf-theme-button" data-theme="dark" icon="dark_mode" aria-label="Тёмная"></sf-icon-button>
</body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/ru' || path === '/en') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(path.slice(1)));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const failures = [];
const seen = {};
const browser = await chromium.launch();
try {
  const tab = await browser.newPage({colorScheme: 'light'});
  await tab.goto(`http://127.0.0.1:${server.address().port}/ru`);
  await tab.waitForFunction(() => window.SF?.Loader?.setTheme && document.querySelector('#host')?.getAttribute('icon'), null, {timeout: 15000})
    .catch(() => failures.push('the toggle never got a glyph'));
  // Read only once every host has started, so the moved data-theme is what the
  // runtime sees every run, not in a race with the component's start.
  await tab.waitForFunction(() => [...document.querySelectorAll('sf-icon-button')].every((host) => host.querySelector(':scope > button')), null, {timeout: 15000})
    .catch(() => failures.push('an sf-icon-button never drew its button'));
  const glyphs = () => tab.evaluate(() => ({
    host: document.querySelector('#host').getAttribute('icon'),
    native: document.querySelector('#native .sf-icon').textContent.trim(),
    own: document.querySelector('#own').getAttribute('icon'),
    choice: document.querySelector('#choice').getAttribute('icon'),
  }));
  seen.light = await glyphs();
  await tab.evaluate(() => window.SF.Loader.setTheme('dark'));
  await tab.waitForTimeout(200);
  seen.dark = await glyphs();
  await tab.evaluate(() => window.SF.Loader.setTheme('light'));
  await tab.waitForTimeout(200);
  seen.back = await glyphs();
  // From a dark page: a toggle would go light, the dark choice stays dark.
  await tab.evaluate(() => window.SF.Loader.setTheme('dark'));
  await tab.waitForTimeout(200);
  await tab.click('#choice');
  await tab.waitForTimeout(200);
  seen.clicked = await tab.evaluate(() => ({preference: window.SF.Loader.themePreference, dark: document.documentElement.classList.contains('theme-dark'), pressed: document.querySelector('#choice').getAttribute('aria-pressed')}));
  const expect = (name, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${name}: ${JSON.stringify(got)}`); };
  expect('light page: moons, the author glyph and the choice untouched', seen.light, {host: 'dark_mode', native: 'dark_mode', own: 'palette', choice: 'dark_mode'});
  expect('dark page: suns, the author glyph and the choice untouched', seen.dark, {host: 'light_mode', native: 'light_mode', own: 'palette', choice: 'dark_mode'});
  expect('back to light: moons again', seen.back, seen.light);
  expect('a click on the dark choice sets dark, pressed', seen.clicked, {preference: 'dark', dark: true, pressed: 'true'});
  await tab.close();
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(seen));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('THEME_BUTTON_GLYPH_OK');
