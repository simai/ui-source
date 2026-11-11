#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// (PLAYWRIGHT_MODULE=/abs/module.mjs picks another Playwright, as other probes allow.)
//
// sf-input-rich's link editor is a sheet on a phone and a popup at the link
// tool on a desktop (C32, RT-02), with sf-popover 1.5.0's anchored placement
// (recipes gaps, C39) in the same build. At 390x900 the open surface carries
// data-sf-sheet and stands on the bottom edge across the screen (it hung at
// the top, bottom 233 of 900, while sf-popover anchored it); at 1440x900 it has
// no data-sf-sheet and hangs from the link tool inside the window. Both
// themes, three loads each; no page errors.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
for (const [name, path] of Object.entries(parts)) if (!existsSync(path)) throw new Error(`${name} not found under ${out}`);

const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};
let current = '';
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/probe') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(current);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  const charset = ['.js', '.mjs', '.css', '.json', '.svg', '.html'].includes(extname(file)) ? '; charset=utf-8' : '';
  response.writeHead(200, {'content-type': `${types[extname(file)] ?? 'application/octet-stream'}${charset}`});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

const shell = (theme, body) => `<!doctype html><html lang="en" class="${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false},icons:{enabled:false}};
window.__ran = 0; window.alert = () => { window.__ran += 1; };</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body style="margin:0;padding:16px;display:grid;gap:16px;background:var(--sf-surface-0)">
${body}
</body></html>`;

const failures = [];
const evidence = [];
const check = (name, pass, detail = {}) => {
  if (!pass) failures.push({name, ...detail});
};
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

const browser = await chromium.launch();
try {
  for (const [width, height] of [[390, 900], [1440, 900]]) {
    for (const theme of ['theme-light', 'theme-dark']) {
      for (let load = 1; load <= 3; load += 1) {
        const page = await browser.newPage({viewport: {width, height}});
        const errors = [];
        page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) errors.push(error.message); });
        current = shell(theme, '<sf-input-rich id="r" label="Page text" value="<p>Start of the text</p>"></sf-input-rich>');
        await page.goto(`${base}/probe`, {waitUntil: 'load'});
        await page.waitForFunction(() => customElements.get('sf-input-rich')
          && document.querySelector('#r .sf-rich-text-editor')
          && document.querySelectorAll('#r button.sf-rich-text-tool').length === 12, null, {timeout: 20000});
        await page.evaluate(() => {
          const editor = document.querySelector('#r .sf-rich-text-editor');
          editor.focus();
          const range = document.createRange();
          range.selectNodeContents(editor.firstElementChild);
          getSelection().removeAllRanges();
          getSelection().addRange(range);
        });
        await page.keyboard.press(`${mod}+k`);
        await page.waitForFunction(() => {
          const surface = document.querySelector('#r sf-popover.sf-rich-text-link > [slot="content"]');
          return surface && surface.getBoundingClientRect().height > 0;
        }, null, {timeout: 10000});
        await page.waitForTimeout(400);
        const got = await page.evaluate(() => {
          const surface = document.querySelector('#r sf-popover.sf-rich-text-link > [slot="content"]');
          const rect = surface.getBoundingClientRect();
          const tool = [...document.querySelectorAll('#r button.sf-rich-text-tool')].find((button) => /link|ссылк/iu.test(button.getAttribute('aria-label') || ''));
          const at = tool?.getBoundingClientRect();
          return {
            sheet: surface.hasAttribute('data-sf-sheet'),
            left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width,
            inline: surface.getAttribute('style') || '',
            tool: at ? {left: at.left, right: at.right, top: at.top, bottom: at.bottom} : null,
            viewport: {width: innerWidth, height: innerHeight},
          };
        });
        const where = `${width} ${theme} load ${load}`;
        evidence.push({where, ...got});
        if (width < 704) {
          check(`${where}: a sheet`, got.sheet, got);
          check(`${where}: on the bottom edge`, Math.abs(got.bottom - height) <= 1, got);
          check(`${where}: across the screen`, Math.abs(got.left) <= 1 && Math.abs(got.width - width) <= 1, got);
        } else {
          check(`${where}: not a sheet`, !got.sheet, got);
          check(`${where}: inside the window`, got.left >= -1 && got.right <= width + 1 && got.top >= -1 && got.bottom <= height + 1, got);
          check(`${where}: hangs from the link tool`, got.tool && ((got.top >= got.tool.bottom - 1 && got.top - got.tool.bottom <= 24) || (got.bottom <= got.tool.top + 1 && got.tool.top - got.bottom <= 24)), got);
        }
        check(`${where}: no page errors`, errors.length === 0, {errors});
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({evidence: evidence.map(({where, sheet, left, top, bottom, width}) => ({where, sheet, left, top, bottom, width})), failures}, null, 1));
if (failures.length) {
  console.error(`${failures.length} rich-text link sheet failure(s)`);
  process.exit(1);
}
