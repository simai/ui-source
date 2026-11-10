#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The buttons after the owner's review on pair ui-b4a77681f0a7 (decision C36),
// measured on the built bytes through the loader, light and dark, desktop
// (1440) and phone (390):
//   - a loading sf-button keeps its scheme colour: the fill, the edge and the
//     label of the resting button, on every appearance and colour; its
//     spinner takes the label's ink. A disabled button, and a disabled one
//     that is also loading, wear the disabled look as before;
//   - full-width: the control fills its container (sf-segmented's name and
//     meaning), its content stays centred; without it the button hugs its
//     content; the property follows the attribute;
//   - an icon-only sf-button is not square (it keeps the button's side
//     padding); sf-button-icon is the square one, at every size;
//   - compact density moves buttons one step down on the desktop and leaves
//     them as they are on the phone, whose ladder already is the dense one;
//   - sf-button-close at its default size 1/3 is 28 on the desktop (C27), 24
//     on the phone, and is the icon button's square.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'core', 'core', 'css', 'core.css')]
  .filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2'};
const pageOf = (body, theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath = '/distr/'; window.SF_BOOT_CONFIG = {icons: {enabled: false}};</script>
<script src="/distr/core/js/core.js"></script></head><body style="margin:0">${body}</body></html>`;
const serve = (pages) => createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (pages[path]) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
    return response.end(pages[path]);
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const body = await readFile(file);
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'});
    response.end(body);
  } catch {
    response.writeHead(404); response.end();
  }
});

const SIZES = ['1/3', '1/2', '1', '2', '3'];
const APPEARANCES = ['default', 'tonal', 'outline', 'ghost', 'surface'];
// The colour a button takes: a scheme, or the danger status.
const COLOURS = [['scheme', 'primary'], ['scheme', 'secondary'], ['scheme', 'on-surface'], ['scheme', 'on-surface-variant'], ['status', 'danger']];
// surface with on-surface-variant is retired (1.11.0): it draws on-surface and warns.
const combos = APPEARANCES.flatMap((appearance) => COLOURS
  .filter(([, colour]) => !(appearance === 'surface' && colour === 'on-surface-variant'))
  .map(([key, colour]) => ({appearance, key, colour})));

const loadingRows = combos.map(({appearance, key, colour}) => {
  const common = `appearance="${appearance}" ${key}="${colour}"`;
  return `<div data-combo="${appearance}|${colour}" style="display:flex;gap:8px;margin:4px 0">
    <sf-button data-role="rest" ${common} text="Сохранить" icon-start="save"></sf-button>
    <sf-button data-role="loading" ${common} text="Сохранить" icon-start="save" loading></sf-button>
    <sf-button data-role="rest-text" ${common} text="Сохранить"></sf-button>
    <sf-button data-role="loading-text" ${common} text="Сохранить" loading></sf-button>
    <sf-button data-role="disabled" ${common} text="Сохранить" icon-start="save" disabled></sf-button>
    <sf-button data-role="disabled-loading" ${common} text="Сохранить" icon-start="save" disabled loading></sf-button>
  </div>`;
}).join('');

const shapeRows = SIZES.map((size) => `<div data-size="${size}" style="display:flex;gap:8px;margin:4px 0;align-items:flex-start">
    <sf-button data-role="icon-only" size="${size}" icon="search" aria-label="Найти"></sf-button>
    <sf-button-icon data-role="icon-button" size="${size}" icon="search" aria-label="Найти"></sf-button-icon>
    <sf-button data-role="normal" size="${size}" text="Сохранить"></sf-button>
  </div>`).join('');

// Density: a button without a size in a compact region stands where the size
// below stands in a normal one; the five sizes are read on explicitly sized
// buttons, the compact one is the default size (1) in a compact region.
const densityRow = `<div data-density style="display:flex;gap:8px;margin:4px 0;align-items:flex-start">
    <sf-button data-role="normal-default" text="Сохранить"></sf-button>
    <div data-sf-density="compact" style="display:flex;gap:8px">
      <sf-button data-role="compact-default" text="Сохранить"></sf-button>
      <sf-button-icon data-role="compact-icon" icon="search" aria-label="Найти"></sf-button-icon>
    </div>
    <sf-button-icon data-role="normal-icon" icon="search" aria-label="Найти"></sf-button-icon>
  </div>`;

const widthRows = `<div data-full style="width:320px;margin:8px 0;display:flex;flex-direction:column;gap:8px;align-items:flex-start">
    <sf-button data-role="hug" text="Войти" icon-start="login"></sf-button>
    <sf-button data-role="full" full-width text="Войти" icon-start="login"></sf-button>
    <sf-button data-role="full-text" full-width text="Войти"></sf-button>
    <sf-button data-role="full-prop" text="Войти" icon-start="login"></sf-button>
    <sf-segmented data-role="segmented" full-width aria-label="Период" value="w" items='[{"value":"d","label":"День"},{"value":"w","label":"Неделя"}]'></sf-segmented>
  </div>`;

const closeRow = `<div data-close style="display:flex;gap:8px;margin:8px 0;align-items:flex-start">
    <sf-button-close data-role="close"></sf-button-close>
    <sf-button-icon data-role="icon-1-3" size="1/3" icon="search" aria-label="Найти"></sf-button-icon>
  </div>`;

const body = `<div style="padding:16px">${widthRows}${closeRow}${densityRow}${shapeRows}${loadingRows}</div>`;
const pages = {'/light.html': pageOf(body, 'light'), '/dark.html': pageOf(body, 'dark')};

const failures = [];
const report = {};
const server = serve(pages);
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const near = (a, b, tolerance = 0.5) => Math.abs(a - b) <= tolerance;
try {
  for (const theme of ['light', 'dark']) {
    for (const [view, width] of [['desktop', 1440], ['phone', 390]]) {
      const page = await browser.newPage({viewport: {width, height: 900}});
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(`${base}/${theme}.html`);
      await page.waitForFunction(() => ['sf-button', 'sf-button-icon', 'sf-button-close', 'sf-segmented'].every((tag) => customElements.get(tag)), null, {timeout: 15000});
      await page.waitForFunction(() => [...document.querySelectorAll('sf-button, sf-button-icon, sf-button-close')].every((host) => host.querySelector('button')), null, {timeout: 15000});
      await page.waitForTimeout(400);
      // The property says what the attribute says.
      await page.evaluate(() => { document.querySelector('[data-role="full-prop"]').closest('sf-button').fullWidth = true; });
      await page.waitForTimeout(200);
      const where = `${theme} ${view}`;
      const data = await page.evaluate(() => {
        const box = (node) => { const r = node.getBoundingClientRect(); return {x: r.x, y: r.y, width: r.width, height: r.height, right: r.right}; };
        // A host moves its data-* to the native button (sf-button docs), so a
        // role names the button itself, or a host that kept it.
        const button = (node) => (node.matches('button') ? node : node.querySelector('button'));
        const read = (host) => {
          const control = button(host);
          const style = getComputedStyle(control);
          const label = control.querySelector('.sf-button-text-container');
          const icon = control.querySelector(':scope > sf-icon .sf-icon, :scope > .sf-icon');
          const spinner = control.querySelector('.sf-button-spinner');
          return {
            background: style.backgroundColor,
            border: style.borderTopColor,
            borderWidth: style.borderTopWidth,
            label: label ? getComputedStyle(label).color : null,
            icon: icon ? getComputedStyle(icon).color : null,
            spinner: spinner ? getComputedStyle(spinner).color : null,
            disabled: control.disabled,
            busy: control.getAttribute('aria-busy'),
          };
        };
        const loading = Object.fromEntries([...document.querySelectorAll('[data-combo]')].map((row) => [row.dataset.combo,
          Object.fromEntries([...row.querySelectorAll('[data-role]')].map((host) => [host.dataset.role, read(host)]))]));
        const shapes = Object.fromEntries([...document.querySelectorAll('[data-size]')].map((row) => [row.dataset.size,
          Object.fromEntries([...row.querySelectorAll('[data-role]')].map((host) => [host.dataset.role, box(button(host))]))]));
        const density = Object.fromEntries([...document.querySelectorAll('[data-density] [data-role]')].map((host) => [host.dataset.role, box(button(host))]));
        const container = document.querySelector('[data-full]');
        const full = Object.fromEntries([...container.querySelectorAll('[data-role]')].map((host) => {
          const control = host.dataset.role === 'segmented' ? (host.closest('sf-segmented') || host).querySelector('.sf-button-group') || host.closest('.sf-button-group') : button(host);
          const icon = control.querySelector('.sf-icon');
          const label = control.querySelector('.sf-button-text-container');
          // The text itself: a label that takes the free room is wider than its words.
          const words = label ? (() => { const range = document.createRange(); range.selectNodeContents(label); return box(range); })() : null;
          return [host.dataset.role, {box: box(control), icon: icon ? box(icon) : null, label: label ? box(label) : null, words}];
        }));
        const close = Object.fromEntries([...document.querySelectorAll('[data-close] [data-role]')].map((host) => [host.dataset.role, box(button(host))]));
        const ink = (name) => { const probe = document.createElement('span'); probe.style.color = `var(${name})`; document.body.append(probe); const value = getComputedStyle(probe).color; probe.remove(); return value; };
        return {loading, shapes, density, full, container: box(container), close, onDisable: ink('--sf-on-disable')};
      });
      report[where] = {
        close: data.close,
        density: Object.fromEntries(Object.entries(data.density).map(([role, value]) => [role, [value.width, value.height]])),
        shapes: Object.fromEntries(Object.entries(data.shapes).map(([size, row]) => [size, Object.fromEntries(Object.entries(row).map(([role, value]) => [role, `${value.width.toFixed(1)}x${value.height.toFixed(1)}`]))])),
        full: Object.fromEntries(Object.entries(data.full).map(([role, value]) => [role, value.box.width])),
        loading: Object.fromEntries(Object.entries(data.loading).map(([combo, row]) => [combo, {rest: [row.rest.background, row.rest.label], loading: [row.loading.background, row.loading.label, row.loading.spinner], disabled: [row.disabled.background, row.disabled.label]}])),
      };

      // Loading keeps the scheme colour.
      for (const [combo, row] of Object.entries(data.loading)) {
        for (const [rest, loading] of [['rest', 'loading'], ['rest-text', 'loading-text']]) {
          const a = row[rest]; const b = row[loading];
          for (const key of ['background', 'border', 'borderWidth']) {
            if (a[key] !== b[key]) failures.push({where, combo, check: `${loading} ${key} is the resting one`, rest: a[key], loading: b[key]});
          }
          if (b.busy !== 'true' || !b.disabled) failures.push({where, combo, check: `${loading} is busy and natively disabled`, busy: b.busy, disabled: b.disabled});
          if (b.spinner !== a.label) failures.push({where, combo, check: `${loading} spinner takes the label ink`, label: a.label, spinner: b.spinner});
        }
        if (row.loading.label !== row.rest.label) failures.push({where, combo, check: 'loading label is the resting ink', rest: row.rest.label, loading: row.loading.label});
        // Disabled keeps its look; disabled and loading is disabled.
        if (row.disabled.label !== data.onDisable) failures.push({where, combo, check: 'disabled label is the disabled ink', label: row.disabled.label, onDisable: data.onDisable});
        for (const key of ['background', 'border', 'label']) {
          if (row['disabled-loading'][key] !== row.disabled[key]) failures.push({where, combo, check: `disabled+loading ${key} is the disabled one`, disabled: row.disabled[key], both: row['disabled-loading'][key]});
        }
        if (row['disabled-loading'].spinner !== data.onDisable) failures.push({where, combo, check: 'disabled+loading spinner is the disabled ink', spinner: row['disabled-loading'].spinner});
      }

      // Full width.
      const {full, container} = data;
      if (!near(full.full.box.width, container.width)) failures.push({where, check: 'full-width fills the container', width: full.full.box.width, container: container.width});
      if (!near(full['full-text'].box.width, container.width)) failures.push({where, check: 'full-width (text only) fills the container', width: full['full-text'].box.width});
      if (!near(full['full-prop'].box.width, container.width)) failures.push({where, check: 'fullWidth property fills the container', width: full['full-prop'].box.width});
      if (!near(full.segmented.box.width, container.width)) failures.push({where, check: 'sf-segmented full-width fills the same container', width: full.segmented.box.width});
      if (!(full.hug.box.width < container.width - 50)) failures.push({where, check: 'without full-width the button hugs its content', width: full.hug.box.width});
      if (!near(full.full.box.height, full.hug.box.height)) failures.push({where, check: 'full-width keeps the height', full: full.full.box.height, hug: full.hug.box.height});
      {
        const start = full.full.icon.x - full.full.box.x;
        const end = full.full.box.right - full.full.label.right;
        if (!near(start, end, 1)) failures.push({where, check: 'full-width content is centred', start, end});
        const textStart = full['full-text'].words.x - full['full-text'].box.x;
        const textEnd = full['full-text'].box.right - full['full-text'].words.right;
        if (!near(textStart, textEnd, 1)) failures.push({where, check: 'full-width text is centred', textStart, textEnd});
      }

      // Icon-only sf-button is not square; sf-button-icon is.
      for (const [size, row] of Object.entries(data.shapes)) {
        if (!(row['icon-only'].width > row['icon-only'].height + 4)) failures.push({where, size, check: 'icon-only sf-button is wider than tall', box: row['icon-only']});
        if (!near(row['icon-button'].width, row['icon-button'].height)) failures.push({where, size, check: 'sf-button-icon is square', box: row['icon-button']});
        if (!near(row['icon-only'].height, row['icon-button'].height)) failures.push({where, size, check: 'icon-only sf-button and sf-button-icon stand the same height', a: row['icon-only'].height, b: row['icon-button'].height});
      }

      // Density.
      const d = data.density;
      if (view === 'phone') {
        if (!near(d['compact-default'].height, d['normal-default'].height)) failures.push({where, check: 'compact leaves a phone button as it is', normal: d['normal-default'].height, compact: d['compact-default'].height});
        if (!near(d['compact-icon'].height, d['normal-icon'].height)) failures.push({where, check: 'compact leaves a phone icon button as it is', normal: d['normal-icon'].height, compact: d['compact-icon'].height});
      } else {
        const below = data.shapes['1/2'].normal.height;
        if (!near(d['compact-default'].height, below)) failures.push({where, check: 'compact moves a desktop button one step down', compact: d['compact-default'].height, below});
        if (!(d['compact-icon'].height < d['normal-icon'].height)) failures.push({where, check: 'compact moves a desktop icon button down', normal: d['normal-icon'].height, compact: d['compact-icon'].height});
      }

      // The close button at its default size 1/3.
      const expected = view === 'desktop' ? 28 : 24;
      const close = data.close.close;
      if (!near(close.height, expected) || !near(close.width, expected)) failures.push({where, check: `sf-button-close 1/3 is ${expected}`, box: close});
      if (!near(close.height, data.close['icon-1-3'].height)) failures.push({where, check: 'sf-button-close 1/3 is the icon button 1/3', close: close.height, icon: data.close['icon-1-3'].height});

      if (errors.length) failures.push({where, check: 'console clean', errors});
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({report, failures}, null, 1));
if (failures.length) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('BUTTON_C36_OK');
