#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report] [--json <file>]
//
// A notice's status colour is its own icon only (C35 acceptance A-F1). The
// class alert (.sf-alert, default, outlined and flat) and the class toast
// (.sf-toast) of every status hold the action buttons a page writes -- class
// buttons with an icon (tonal, link, outline and default primary, a bare
// .sf-button), sf-button with icon-start, sf-button-icon and a class icon
// button. In light and dark, at 1440 and 390, three loads each:
//
//   - every action button's icon is the colour the same button draws outside
//     the notice, in a twin place that carries every role the notice's root
//     resolves (its custom properties and its colour: a toast is a popup
//     place, a neutral filled notice moves --sf-on-surface-variant to its
//     container's): the button's own icon role, never the status tone;
//   - the notice's own icon still takes its status role and its cross stays
//     the notice's text ink (the notice-ink probe holds the full table);
//   - the console is clean and the three loads agree.
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

const classButton = (id, classes, icon) => `<button type="button" data-b="${id}" class="sf-button ${classes} sf-button--size-1 sf-button--height-low flex items-cross-center"><i class="sf-icon" aria-hidden="true">${icon}</i><span class="sf-button-text-container">Действие</span></button>`;
const BUTTONS = [
  classButton('tonal-primary', 'sf-button--tonal sf-button--primary', 'refresh'),
  classButton('link-on-surface', 'sf-button--ghost sf-button--on-surface', 'logout'),
  classButton('outline-primary', 'sf-button--outline sf-button--primary', 'open_in_new'),
  classButton('default-primary', 'sf-button--default sf-button--primary', 'check'),
  `<button type="button" data-b="bare" class="sf-button sf-button--size-1 sf-button--height-low flex items-cross-center"><i class="sf-icon" aria-hidden="true">star</i><span class="sf-button-text-container">Действие</span></button>`,
  `<sf-button data-b="smart-tonal" appearance="tonal" scheme="primary" size="1" height="low" icon-start="refresh" text="Действие"></sf-button>`,
  `<sf-button data-b="smart-ghost" appearance="ghost" scheme="on-surface" size="1" height="low" icon-start="logout" text="Действие"></sf-button>`,
  `<sf-button-icon data-b="smart-icon" appearance="ghost" scheme="on-surface" size="1" height="low" icon="more_vert" aria-label="Ещё"></sf-button-icon>`,
  `<button type="button" data-b="class-icon" class="sf-icon-button sf-icon-button--link sf-icon-button--on-surface sf-icon-button--size-1 sf-icon-button--height-low flex items-cross-center" aria-label="Ещё"><i class="sf-icon" aria-hidden="true">more_vert</i></button>`,
].join('');
const KINDS = ['tonal-primary', 'link-on-surface', 'outline-primary', 'default-primary', 'bare', 'smart-tonal', 'smart-ghost', 'smart-icon', 'class-icon'];
const close = `<button type="button" class="sf-icon-button sf-icon-button--close sf-icon-button--link sf-icon-button--on-surface sf-icon-button--size-1 sf-icon-button--height-low flex items-cross-center" aria-label="Закрыть"><span class="sf-close sf-close--size-1 flex justify-center items-center" aria-hidden="true"><span class="sf-close-icon"></span></span></button>`;

const classAlert = (level, appearance) => `
  <div data-k="alert-${level}-${appearance}" data-level="${level}" class="sf-alert sf-alert--${level} sf-alert--${appearance} flex items-start" role="status">
    <i class="sf-icon" aria-hidden="true">${ICON[level]}</i>
    <div class="sf-alert-wrap flex flex-col flex-1"><div class="sf-alert-content flex flex-col flex-1"><div class="sf-alert-text">${H}</div><div class="sf-alert-supporting-text">${B}</div></div>
      <div class="sf-alert-buttons flex flex-wrap items-center">${BUTTONS}</div></div>
    ${close}
  </div>`;
const classToast = (level) => `
  <div data-k="toast-${level}" data-level="${level}" class="sf-toast sf-toast--${level} flex items-cross-start">
    <i class="sf-icon" aria-hidden="true">${ICON[level]}</i>
    <div class="sf-toast-container flex flex-col flex-1"><div class="sf-toast-wrap flex flex-col"><div class="sf-toast-text">${H}</div><div class="sf-toast-supporting-text">${B}</div></div>
      <div class="sf-toast-bottom flex items-center">${BUTTONS}</div></div>
    ${close.replace('sf-icon-button--close', 'sf-icon-button--close sf-icon-button--variant-close')}
  </div>`;

const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.SF_BOOT_CONFIG={theme:false};window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<style>.zone{display:flex;flex-direction:column;gap:12px;margin:16px;max-inline-size:40rem}</style>
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface"><section class="zone">
${LEVELS.map((level) => [...APPEARANCES.map((appearance) => classAlert(level, appearance)), classToast(level)].join('\n')).join('\n')}
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

// For each notice, a twin outside it: a plain box that carries every custom
// property and the colour the notice's root resolves, holding the same buttons.
const TWINS = (buttons) => {
  let copied = 0;
  for (const root of document.querySelectorAll('[data-k]')) {
    const twin = document.createElement('div');
    twin.dataset.twin = root.dataset.k;
    twin.className = 'flex flex-wrap items-center';
    const style = getComputedStyle(root);
    for (const name of style) {
      if (!name.startsWith('--')) continue;
      twin.style.setProperty(name, style.getPropertyValue(name));
      copied += 1;
    }
    twin.style.color = style.color;
    twin.innerHTML = buttons;
    root.after(twin);
  }
  return copied;
};

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
  const colour = (node) => (node ? hex(rgba(getComputedStyle(node).color)) : null);
  // A token as the notice resolves it: a probe element inside the notice.
  const token = (name, place) => {
    const probe = document.createElement('i');
    probe.style.color = `var(${name})`;
    place.append(probe);
    const value = colour(probe);
    probe.remove();
    return value;
  };
  // The plate a button's icon stands on: its own fill over the notice's.
  const over = (top, under) => {
    const a = top[3] / 255;
    return [0, 1, 2].map((i) => Math.round(top[i] * a + under[i] * (1 - a))).concat(255);
  };
  const plate = (node) => {
    const chain = [];
    for (let at = node; at && at !== document.documentElement; at = at.parentElement) chain.unshift(at);
    return chain.reduce((under, at) => over(rgba(getComputedStyle(at).backgroundColor), under), rgba(getComputedStyle(document.body).backgroundColor));
  };
  const buttons = (host) => {
    const found = {};
    for (const node of host.querySelectorAll('[data-b]')) {
      const button = node.matches('button') ? node : node.querySelector('button');
      const icon = button?.querySelector('.sf-icon');
      found[node.dataset.b] = {icon: colour(icon), label: colour(button?.querySelector('.sf-button-text-container')), plate: button ? hex(plate(button)) : null};
    }
    return found;
  };
  const seen = {};
  for (const root of document.querySelectorAll('[data-k]')) {
    seen[root.dataset.k] = {
      level: root.dataset.level,
      // One status tone per notice, the notice-ink probe's: neutral is the
      // theme's quiet role, read on the page -- the dim ink on a fill for a
      // filled notice, the page's for an outlined alert -- not the role a
      // popup place (the toast) re-declares for its controls (C43).
      tone: root.dataset.level !== 'neutral'
        ? token(`--sf-${root.dataset.level}`, root)
        : token(root.classList.contains('sf-alert--outlined') ? '--sf-on-surface-variant' : '--sf-on-surface-container--variant', document.body),
      own: colour(root.querySelector(':scope > .sf-icon, :scope > sf-icon > .sf-icon')),
      cross: root.querySelector(':scope > .sf-icon-button .sf-close-icon') ? hex(rgba(getComputedStyle(root.querySelector(':scope > .sf-icon-button .sf-close-icon')).backgroundColor)) : null,
      text: colour(root.querySelector('.sf-alert-text, .sf-toast-text')),
      buttons: buttons(root),
      twin: buttons(document.querySelector(`[data-twin="${root.dataset.k}"]`)),
    };
  }
  return {seen};
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
        tab.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
        await tab.goto(`http://127.0.0.1:${server.address().port}/?theme=${theme}`);
        const ready = () => tab.waitForFunction(() => [...document.querySelectorAll('[data-b]:not(button)')].every((node) => node.querySelector('button .sf-icon')), null, {timeout: 30000})
          .catch(() => failures.push(`${label}-${theme} load ${load}: the Smart buttons never drew their icons`));
        await ready();
        await tab.waitForTimeout(300);
        if (!(await tab.evaluate(TWINS, BUTTONS))) failures.push(`${label}-${theme} load ${load}: no custom property reached the twins`);
        await ready();
        await tab.waitForTimeout(300);
        loads.push(await tab.evaluate(MEASURE, LEVELS));
        if (errors.length) failures.push(`${label}-${theme} load ${load}: console ${JSON.stringify(errors)}`);
        await tab.close();
      }
      if (new Set(loads.map((one) => JSON.stringify(one))).size !== 1) failures.push(`${label}-${theme}: the three loads disagree`);
      const {seen} = loads[0];
      for (const [key, notice] of Object.entries(seen)) {
        const level = notice.level;
        const place = notice.twin;
        if (!notice.own || notice.own === notice.text) failures.push(`${label}-${theme} ${key}: own icon ${notice.own} is not the status tone`);
        if (notice.own && notice.own !== notice.tone) failures.push(`${label}-${theme} ${key}: own icon ${notice.own}, want ${notice.tone}`);
        if (notice.cross !== notice.text) failures.push(`${label}-${theme} ${key}: cross ${notice.cross} is not the text's ink ${notice.text}`);
        for (const kind of KINDS) {
          const got = notice.buttons[kind];
          const want = place[kind];
          if (!got || !got.icon) { failures.push(`${label}-${theme} ${key} ${kind}: no icon drawn`); continue; }
          const row = {view: label, theme, key, kind, icon: got.icon, want: want.icon, label: got.label, tone: notice.tone, plate: got.plate, iconOnPlate: contrast(got.icon.slice(0, 7), got.plate)};
          report.push(row);
          if (got.icon !== want.icon) failures.push(`${label}-${theme} ${key} ${kind}: icon ${got.icon}, the button's own ${want.icon}${got.icon === notice.tone ? ' (the status tone)' : ''}`);
          if (got.icon === notice.tone && want.icon !== notice.tone) failures.push(`${label}-${theme} ${key} ${kind}: icon takes the status tone ${notice.tone}`);
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
  for (const row of report.filter((one) => one.view === 'desktop')) console.log(`${row.theme.padEnd(5)} ${row.key.padEnd(24)} ${row.kind.padEnd(16)} icon ${row.icon} own ${row.want} label ${row.label} tone ${row.tone} on plate ${row.iconOnPlate}`);
  if (failures.length) console.log(`${failures.length} differences`);
  process.exit(0);
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`NOTICE_ACTION_ICONS_OK ${report.length} button icons`);
