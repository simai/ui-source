#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Build output root is required: the directory holding core/, smart/, component/, utility/.
//
// sf-wizard 1.3.4 (owner decision C101 (4)): progress auto draws the row of
// steps while it fits the wizard's own width and «Шаг N из M» where it does
// not, and draws the row again when the wizard grows. On the built bytes with
// the real Loader, light and dark, left to right and right to left:
//   five short labels in 48rem             the row fits: the row
//   five long Russian labels in 48rem      the row does not fit: the count line
//   the long five, the box widened to the row's width, then narrowed by a pixel
// Wherever the row is drawn its last label is not cut and the row does not
// scroll; wherever the count line is drawn the row is out of view. No page
// errors, no failed requests.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = process.argv[2];
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html'};

const SHORT = ['Файл', 'Поля', 'Проверка', 'Импорт', 'Итог'];
const LONG = ['Подключение к базе данных', 'Учётная запись администратора', 'Модули и расширения', 'Проверка перед установкой', 'Готово'];
const wizard = (labels) => `<div id="box" style="inline-size: 48rem">
<sf-wizard id="w" heading="Установка Larena">${labels.map((label, i) => `<sf-wizard-step name="s${i}" label="${label}"><p>${label}.</p></sf-wizard-step>`).join('')}</sf-wizard></div>`;
const head = (theme, dir) => `<!doctype html><html lang="ru" dir="${dir}" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css"><script src="/distr/core/js/core.js"></script>
<style>body{margin:0;padding:16px;background:var(--sf-surface);color:var(--sf-on-surface)}</style></head><body>`;

let theme = 'light';
let dir = 'ltr';
const pages = {'/short': wizard(SHORT), '/long': wizard(LONG)};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (pages[path]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(`${head(theme, dir)}${pages[path]}</body></html>`);
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  const type = types[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, {'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const base = `http://127.0.0.1:${server.address().port}`;

// What the head draws, and the row's own need and room (inline styles, reverted).
const SEEN = () => {
  const frame = document.querySelector('.sf-wizard');
  const root = frame?.querySelector('.sf-wizard-steps > .sf-steps');
  const list = root?.querySelector('.sf-steps-container');
  const compact = frame?.querySelector('.sf-wizard-compact');
  if (!frame || !root || !list || !compact) return null;
  const shown = (el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
  const row = shown(root);
  let cut = false;
  let scrolls = false;
  if (row) {
    const lr = list.getBoundingClientRect();
    const last = list.lastElementChild.getBoundingClientRect();
    cut = getComputedStyle(frame).direction === 'rtl' ? last.left < lr.left - 0.5 : last.right > lr.right + 0.5;
    scrolls = list.scrollWidth > list.clientWidth;
  }
  const keep = [root.style.cssText, list.style.cssText];
  root.style.display = 'block';
  list.style.display = 'flex';
  list.style.inlineSize = 'max-content';
  const room = root.getBoundingClientRect().width;
  const need = list.getBoundingClientRect().width;
  [root.style.cssText, list.style.cssText] = keep;
  return {row, count: shown(compact), cut, scrolls, need, room, frame: frame.getBoundingClientRect().width};
};

const results = [];
const browser = await chromium.launch();
try {
  for (const scheme of ['light', 'dark']) for (const direction of ['ltr', 'rtl']) {
    theme = scheme;
    dir = direction;
    for (const [name, path, expect] of [['short-48rem', '/short', 'row'], ['long-48rem', '/long', 'count']]) {
      const context = await browser.newContext({viewport: {width: 1440, height: 900}, locale: 'ru-RU', colorScheme: scheme, reducedMotion: 'reduce'});
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      tab.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
      await tab.goto(`${base}${path}`);
      await tab.waitForFunction(() => customElements.get('sf-wizard') && customElements.get('sf-steps') && document.querySelector('.sf-wizard .sf-steps-container > *'), null, {timeout: 20000}).catch(() => null);
      await tab.waitForLoadState('networkidle', {timeout: 15000}).catch(() => null);
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(300);
      const checks = [];
      const look = async (label, want) => {
        const seen = await tab.evaluate(SEEN);
        const fail = [];
        if (!seen) fail.push('no frame drawn');
        else {
          const drawn = seen.row && !seen.count ? 'row' : !seen.row && seen.count ? 'count' : 'both or neither';
          if (drawn !== want) fail.push(`${drawn} drawn, ${want} expected (row ${seen.need.toFixed(2)} in ${seen.room.toFixed(2)})`);
          if (seen.row && (seen.cut || seen.scrolls)) fail.push('the row is cut or scrolls');
        }
        checks.push({label, seen, fail});
        return seen;
      };
      const first = await look('first load', expect);
      if (name === 'long-48rem' && first) {
        // widen the box to the row's width, then narrow it by a pixel
        const inset = first.frame - first.room;
        const fit = Math.ceil(first.need + inset);
        for (const [label, width, want] of [['widened to the row', fit, 'row'], ['a pixel narrower', fit - 1, 'count'], ['widened again', fit + 40, 'row']]) {
          await tab.evaluate((px) => { document.getElementById('box').style.inlineSize = `${px}px`; }, width);
          await tab.waitForTimeout(200);
          await look(`${label} (${width} px)`, want);
        }
      }
      const fail = checks.flatMap((check) => check.fail.map((text) => `${check.label}: ${text}`));
      if (errors.length) fail.push(`errors: ${errors.join(' | ')}`);
      results.push({case: `${name}-${scheme}-${direction}`, pass: fail.length === 0, checks, fail});
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((row) => !row.pass);
console.log(JSON.stringify({ok: failed.length === 0, cases: results.length, failed: failed.length, results}, null, 2));
if (failed.length) process.exitCode = 1;
