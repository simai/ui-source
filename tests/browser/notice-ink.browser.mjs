#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report] [--json <file>]
//
// One notice, one ink (C35 acceptance finding F1): the close's cross and the
// status icon of a notice are drawn in the same colour whichever notice draws
// them -- the Smart alert (sf-alert, its close inside an sf-button-icon host),
// the class alert (.sf-alert) and the toast (sf-toast and the class toast) --
// for every status (neutral, info, success, warning, error), in the light and
// the dark theme, at 1440 and 390, three loads each.
//
//   - the cross is the notice's text ink: the status container's ink
//     (--sf-on-<status>-container) on a filled or flat notice, --sf-on-surface
//     on a neutral one and on an outlined one, whose text stands on the page;
//   - the status icon is the status's role (--sf-<status>), the quiet
//     --sf-on-surface-variant of its place when neutral (alert-role-colors), on every appearance of the alert (the container's graphic
//     tone the toast had read 2.86-3.04:1 in the dark theme);
//   - the cross reads 3:1 against the notice's fill, and so does the icon.
//
// --report prints the colours and exits 0 whatever they say.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const reportOnly = process.argv.includes('--report');
const jsonAt = process.argv.indexOf('--json');
const jsonFile = jsonAt > 0 ? process.argv[jsonAt + 1] : '';
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const LEVELS = ['neutral', 'info', 'success', 'warning', 'error'];
const APPEARANCES = ['default', 'outlined', 'flat'];
const ICON = {neutral: 'notifications', info: 'info', success: 'check_circle', warning: 'warning', error: 'error'};
const H = 'Сессия закончится';
const B = 'Несохранённые изменения пропадут.';

const classAlert = (level, appearance) => `
  <div data-k="class-alert-${level}-${appearance}" class="sf-alert sf-alert--${level} sf-alert--${appearance} flex items-start" role="status">
    <i class="sf-icon" aria-hidden="true">${ICON[level]}</i>
    <div class="sf-alert-wrap flex flex-col flex-1"><div class="sf-alert-content flex flex-col flex-1"><div class="sf-alert-text">${H}</div><div class="sf-alert-supporting-text">${B}</div></div></div>
    <button type="button" class="sf-icon-button sf-icon-button--close sf-icon-button--link sf-icon-button--on-surface sf-icon-button--size-1 sf-icon-button--height-low flex items-cross-center" aria-label="Закрыть">
      <span class="sf-close sf-close--size-1 flex justify-center items-center" aria-hidden="true"><span class="sf-close-icon"></span></span>
    </button>
  </div>`;
const classToast = (level) => `
  <div data-k="class-toast-${level}" class="sf-toast sf-toast--${level} flex items-cross-start">
    <i class="sf-icon" aria-hidden="true">${ICON[level]}</i>
    <div class="sf-toast-container flex flex-col flex-1"><div class="sf-toast-wrap flex flex-col"><div class="sf-toast-text">${H}</div><div class="sf-toast-supporting-text">${B}</div></div></div>
    <button type="button" class="sf-icon-button sf-icon-button--close sf-icon-button--on-surface sf-icon-button--link sf-icon-button--size-1 sf-icon-button--height-low flex items-cross-center" aria-label="Закрыть" data-close>
      <span class="sf-close sf-close--size-1 flex justify-center items-center" aria-hidden="true"><span class="sf-close-icon"></span></span>
    </button>
  </div>`;

const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.SF_BOOT_CONFIG={theme:false};window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<style>.zone{display:flex;flex-direction:column;gap:12px;margin:16px;max-inline-size:28rem}</style>
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface"><section class="zone">
${LEVELS.map((level) => [
    ...APPEARANCES.map((appearance) => `  <sf-alert data-k="smart-alert-${level}-${appearance}" status="${level}" appearance="${appearance}" icon="${ICON[level]}" heading="${H}" supporting-text="${B}" closable></sf-alert>`),
    ...APPEARANCES.map((appearance) => classAlert(level, appearance)),
    `  <sf-toast data-k="smart-toast-${level}" status="${level}" icon="${ICON[level]}" heading="${H}" supporting-text="${B}"></sf-toast>`,
    classToast(level),
  ].join('\n')).join('\n')}
</section></body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('theme') === 'dark' ? 'dark' : 'light'));
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

// Each notice's drawn root, its status icon, its cross, its fill and text, and
// the tokens it should take, resolved the same way (a probe element's colour).
const MEASURE = (levels) => {
  const canvas = new OffscreenCanvas(1, 1).getContext('2d', {willReadFrequently: true});
  const rgba = (css) => {
    canvas.clearRect(0, 0, 1, 1);
    canvas.fillStyle = '#000';
    canvas.fillStyle = css;
    canvas.fillRect(0, 0, 1, 1);
    return [...canvas.getImageData(0, 0, 1, 1).data];
  };
  const hex = ([r, g, b, a]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}${a === 255 ? '' : a.toString(16).padStart(2, '0')}`;
  const token = (name) => {
    const probe = document.createElement('i');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const value = hex(rgba(getComputedStyle(probe).color));
    probe.remove();
    return value;
  };
  const want = {};
  for (const level of levels) {
    const container = level === 'neutral' ? null : level;
    want[level] = {
      cross: token(container ? `--sf-on-${container}-container` : '--sf-on-surface'),
      icon: token(container ? `--sf-${container}` : '--sf-on-surface-container--variant'),
      pageIcon: token(container ? `--sf-${container}` : '--sf-on-surface-variant'),
      page: token('--sf-on-surface'),
    };
  }
  // The fill under the cross: the notice's background layers over the page.
  const over = (top, under) => {
    const a = top[3] / 255;
    return [0, 1, 2].map((i) => Math.round(top[i] * a + under[i] * (1 - a))).concat(255);
  };
  const pageFill = rgba(getComputedStyle(document.body).backgroundColor);
  const fill = (root) => {
    const style = getComputedStyle(root);
    let base = over(rgba(style.backgroundColor), pageFill);
    const image = style.backgroundImage.match(/linear-gradient\((.+?\)|[^,]+),/u);
    if (image) base = over(rgba(image[1]), base);
    return base;
  };
  const seen = {};
  for (const host of document.querySelectorAll('[data-k]')) {
    const key = host.getAttribute('data-k');
    const root = host.matches('.sf-alert, .sf-toast') ? host : host.querySelector('.sf-alert, .sf-toast');
    if (!root) { seen[key] = {missing: true}; continue; }
    const icon = root.querySelector(':scope > .sf-icon, :scope > sf-icon > .sf-icon');
    const cross = root.querySelector('.sf-close-icon');
    const text = root.querySelector('.sf-alert-text, .sf-toast-text');
    const under = fill(root);
    seen[key] = {
      cross: cross ? hex(rgba(getComputedStyle(cross).backgroundColor)) : null,
      icon: icon ? hex(rgba(getComputedStyle(icon).color)) : null,
      text: text ? hex(rgba(getComputedStyle(text).color)) : null,
      fill: hex(under),
    };
  }
  return {want, seen};
};

const luminance = (value) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
  const c = (v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
};

const failures = [];
const report = [];
const browser = await chromium.launch();
try {
  for (const [label, width] of [['desktop', 1440], ['phone', 390]]) {
    for (const theme of ['light', 'dark']) {
      const loads = [];
      for (let load = 1; load <= 3; load += 1) {
        const tab = await browser.newPage({viewport: {width, height: 1400}});
        const errors = [];
        tab.on('pageerror', (error) => errors.push(error.message));
        tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        await tab.goto(`http://127.0.0.1:${server.address().port}/?theme=${theme}`);
        const expected = LEVELS.length * (APPEARANCES.length * 2 + 2);
        await tab.waitForFunction((n) => [...document.querySelectorAll('[data-k]')].filter((node) => node.querySelector('.sf-close-icon')).length === n, expected, {timeout: 30000})
          .catch(() => failures.push(`${label}-${theme} load ${load}: the page never drew its ${expected} notices with a close`));
        await tab.waitForTimeout(300);
        loads.push(await tab.evaluate(MEASURE, LEVELS));
        if (errors.length) failures.push(`${label}-${theme} load ${load}: console ${JSON.stringify(errors)}`);
        await tab.close();
      }
      if (new Set(loads.map((one) => JSON.stringify(one))).size !== 1) failures.push(`${label}-${theme}: the three loads disagree`);
      const {want, seen} = loads[0];
      for (const level of LEVELS) {
        const kinds = [...APPEARANCES.map((a) => `smart-alert-${level}-${a}`), ...APPEARANCES.map((a) => `class-alert-${level}-${a}`), `smart-toast-${level}`, `class-toast-${level}`];
        for (const key of kinds) {
          const got = seen[key];
          if (!got || got.missing) { failures.push(`${label}-${theme} ${key}: not drawn`); continue; }
          const onPage = key.endsWith('-outlined');
          const cross = onPage ? want[level].page : want[level].cross;
          // Neutral: the quiet icon role of the notice's place -- its container's
          // variant on a filled notice, the page's on an outlined alert.
          const icon = onPage ? want[level].pageIcon : want[level].icon;
          const row = {view: label, theme, key, cross: got.cross, wantCross: cross, icon: got.icon, wantIcon: icon, text: got.text, fill: got.fill,
            crossContrast: got.cross ? contrast(got.cross.slice(0, 7), got.fill) : null, iconContrast: got.icon ? contrast(got.icon.slice(0, 7), got.fill) : null};
          report.push(row);
          if (got.cross !== cross) failures.push(`${label}-${theme} ${key}: cross ${got.cross}, want ${cross}`);
          if (got.icon !== icon) failures.push(`${label}-${theme} ${key}: icon ${got.icon}, want ${icon}`);
          if (got.cross !== got.text) failures.push(`${label}-${theme} ${key}: cross ${got.cross} is not the text's ink ${got.text}`);
          if (row.crossContrast < 3) failures.push(`${label}-${theme} ${key}: cross ${row.crossContrast}:1 on its fill`);
          if (row.iconContrast < 3) failures.push(`${label}-${theme} ${key}: icon ${row.iconContrast}:1 on its fill`);
        }
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (jsonFile) writeFileSync(jsonFile, `${JSON.stringify(report, null, 2)}\n`);
if (reportOnly) {
  for (const row of report.filter((one) => one.view === 'desktop')) console.log(`${row.theme.padEnd(5)} ${row.key.padEnd(28)} cross ${row.cross} (${row.crossContrast}) icon ${row.icon} (${row.iconContrast}) text ${row.text}`);
  if (failures.length) console.log(`${failures.length} differences`);
  process.exit(0);
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`NOTICE_INK_OK ${report.length} notices`);
