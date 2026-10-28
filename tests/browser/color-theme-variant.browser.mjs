#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-color variant="theme": one icon-only button named in the page language
// opens the platform picker; a colour moved and committed through the native
// input rebuilds the page theme on <html> (--sf-primary-40) and says change
// once; the reset button takes the variables back off.
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
<sf-color id="c" variant="theme" name="theme" clearable></sf-color>
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
  for (const [lang, word] of [['ru', 'Цвет темы'], ['en', 'Theme colour']]) {
    const tab = await browser.newPage();
    await tab.goto(`http://127.0.0.1:${server.address().port}/${lang}`);
    await tab.waitForFunction(() => customElements.get('sf-color') && document.querySelector('#c [data-action="theme"] button'), null, {timeout: 15000})
      .catch(() => failures.push(`${lang}: the theme button never drew`));
    const button = await tab.evaluate(() => {
      const native = document.querySelector('#c [data-action="theme"] button');
      const input = document.querySelector('#c .sf-color-input');
      return {
        name: native?.getAttribute('aria-label') ?? null,
        icon: document.querySelector('#c [data-action="theme"]')?.getAttribute('icon') ?? null,
        visible: Boolean(native && native.getBoundingClientRect().width > 0),
        hex: Boolean(document.querySelector('#c .sf-color-text')),
        inputTab: input?.tabIndex ?? null,
      };
    });
    if (button.name !== word) failures.push(`${lang}: the button is named ${JSON.stringify(button.name)}, expected ${word}`);
    if (button.icon !== 'palette') failures.push(`${lang}: the icon is ${button.icon}`);
    if (!button.visible) failures.push(`${lang}: the button has no box`);
    if (button.hex) failures.push(`${lang}: the hex text is drawn in the theme variant`);
    if (button.inputTab !== -1) failures.push(`${lang}: the native input is in the focus order (${button.inputTab})`);

    // The palette arrives through the Loader.
    await tab.waitForFunction(() => window.SF?.ThemePalette?.applyTheme, null, {timeout: 15000})
      .catch(() => failures.push(`${lang}: SF.ThemePalette never loaded`));

    const before = await tab.evaluate(() => document.documentElement.style.getPropertyValue('--sf-primary-40'));
    await tab.evaluate(() => {
      window.changes = [];
      const host = document.querySelector('#c');
      host.addEventListener('change', (event) => window.changes.push(event.detail ?? null));
      const input = host.querySelector('.sf-color-input');
      input.value = '#e5534b';
      input.dispatchEvent(new Event('input', {bubbles: true}));
      input.dispatchEvent(new Event('change', {bubbles: true}));
    });
    await tab.waitForTimeout(200);
    const applied = await tab.evaluate(() => ({
      primary: document.documentElement.style.getPropertyValue('--sf-primary-40'),
      value: document.querySelector('#c').value,
      changes: window.changes,
    }));
    if (!applied.primary || applied.primary === before) failures.push(`${lang}: --sf-primary-40 on <html> did not change (${JSON.stringify(applied.primary)})`);
    if (applied.value !== '#e5534b') failures.push(`${lang}: the value is ${applied.value}`);
    if (applied.changes.length !== 1 || applied.changes[0]?.value !== '#e5534b') failures.push(`${lang}: change fired ${JSON.stringify(applied.changes)}`);

    await tab.waitForFunction(() => document.querySelector('#c [data-action="clear"] button'), null, {timeout: 5000})
      .catch(() => failures.push(`${lang}: no reset button after a colour`));
    await tab.locator('#c [data-action="clear"] button').click().catch(() => {});
    await tab.waitForTimeout(100);
    const restored = await tab.evaluate(() => ({
      primary: document.documentElement.style.getPropertyValue('--sf-primary-40'),
      value: document.querySelector('#c').value,
      changes: window.changes.length,
    }));
    if (restored.primary !== before) failures.push(`${lang}: reset left --sf-primary-40 at ${JSON.stringify(restored.primary)}, expected ${JSON.stringify(before)}`);
    if (restored.value !== '') failures.push(`${lang}: reset left the value ${restored.value}`);
    if (restored.changes !== 2) failures.push(`${lang}: reset fired ${restored.changes - 1} change(s)`);
    seen[lang] = {button, applied, restored};
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({seen, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
