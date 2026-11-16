#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report] [--json <file>]
//
// The even bottom of a notice with its actions under the text (owner decision
// C193, 2026-11-15, refining C114 (5), NS-9 and NS-10): the space under the
// last button equals the space above the status icon's ink, within 1 px. Read
// on drawn pixels (the icon's ink is the glyph, not its box), on the built
// bytes over the Loader, at 1440 and 390, normal and compact density
// (data-sf-density="compact"), light and dark, three loads each, for:
//
//   - sf-alert with one action and with two (under the text in a 28rem
//     column), the class alert as the docs write it, and sf-alert
//     actions-layout="under" in a wide column;
//   - sf-toast actions-layout="under" and the class toast with two actions;
//   - sf-alert-bar narrow (a 28rem column at 1440, the window at 390), its
//     actions under the text (C114 (5), NS-8), at rung 1/2 (an admin bar) and
//     at size 1 (a site bar): the bar row and a row of its open list (Р1,
//     NS-12), which ends the same way (sf-alert-bar 1.6.4).
//
// space under = the notice's inner bottom (inside the border) - the last
// button's plate bottom; space above = the icon's ink edge - the notice's
// inner top, the ink edge as the decision measured it on the prototype
// (prototypes/alert-even-bottom.html): an eighth of the icon's box below its
// top (Material Symbols draw inside the box with that room; 3 of 24, 2.5 of
// 20). The ink as drawn is read too, on pixels: the first row at least half
// way from the notice's own fill to the icon's colour (device pixel ratio 2,
// so to half a CSS pixel). A drawn glyph moves with its subpixel position and
// its shape -- a circle starts at 2 of 24, a triangle lower -- so the drawn
// ink is held to 1.5. The capitals' top (the first letter's ink) is reported
// beside them, for the record.
//
// It fails on a console error, on loads that disagree, on any |under -
// above| over 1 and on any |under - drawn ink| over 1.5. --report prints the
// measurements and exits 0.
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

// The bar's items: the shown one with an action and acknowledge, the others
// (the open list's rows) with an action each; no time, so nothing on the
// page moves with the clock.
const BAR_ITEMS = JSON.stringify({items: [
  {id: 'swap', level: 'warning', text: 'Подкачка занята на 92%: сайты замедляются.', source: 'Сервер', action: {label: 'Посмотреть', href: '#memory'}, acknowledge: {label: 'Прочитано'}},
  {id: 'update', level: 'info', text: 'Доступна новая версия панели.', source: 'Обновление', action: {label: 'Обновить', href: '#update'}},
  {id: 'backup', level: 'info', text: 'Резервная копия готова.', source: 'Копии', action: {label: 'Открыть', href: '#backup'}},
]});

const block = (id) => `
<section class="zone" id="${id}">
  <sf-alert data-k="alert-one" status="warning" heading="Раздел открыт только для чтения"
    supporting-text="Правка вернётся примерно в 15:00." action-text="Подробнее" action="more" closable></sf-alert>
  <sf-alert data-k="alert-two" status="error" heading="Не удалось загрузить заказы" supporting-text="Проверьте связь и повторите."
    action-text="Повторить" action="retry" secondary-action-text="Позже" secondary-action="later" closable></sf-alert>
  <div class="sf-alert sf-alert--info sf-alert--default flex items-start" data-k="alert-class">
    <i class="sf-icon" aria-hidden="true">info</i>
    <div class="sf-alert-wrap flex flex-col flex-1">
      <div class="sf-alert-content flex flex-col flex-1"><div class="sf-alert-text">Сессия закончится</div><div class="sf-alert-supporting-text">Несохранённые изменения пропадут.</div></div>
      <div class="sf-alert-buttons flex flex-wrap items-center">
        <button type="button" class="sf-button sf-button--tonal sf-button--on-surface sf-button--size-1 sf-button--height-low flex items-cross-center" data-action="a"><span class="sf-button-text-container">Продлить</span></button>
        <button type="button" class="sf-button sf-button--ghost sf-button--on-surface sf-button--size-1 sf-button--height-low flex items-cross-center" data-action="b"><span class="sf-button-text-container">Выйти</span></button>
      </div>
    </div>
  </div>
  <sf-toast data-k="toast-under" icon="warning" status="neutral" heading="Сессия закончится через 2 минуты"
    supporting-text="Несохранённые изменения пропадут." action-text="Продлить" action="extend" actions-layout="under"></sf-toast>
  <div class="sf-toast sf-toast--neutral flex items-cross-start" data-k="toast-class">
    <i class="sf-icon" aria-hidden="true">warning</i>
    <div class="sf-toast-container flex flex-col flex-1">
      <div class="sf-toast-wrap flex flex-col"><div class="sf-toast-text">Сессия закончится</div><div class="sf-toast-supporting-text">Несохранённые изменения пропадут.</div></div>
      <div class="sf-toast-bottom flex items-center">
        <button type="button" class="sf-button sf-button--tonal sf-button--on-surface sf-button--size-1 sf-button--height-low flex items-cross-center" data-action="a"><span class="sf-button-text-container">Продлить</span></button>
        <button type="button" class="sf-button sf-button--ghost sf-button--on-surface sf-button--size-1 sf-button--height-low flex items-cross-center" data-action="b"><span class="sf-button-text-container">Выйти</span></button>
      </div>
    </div>
  </div>
</section>
<section class="bars" id="${id}-bars">
  <sf-alert-bar data-k="bar-half"><script type="application/json" data-sf-settings>${BAR_ITEMS}</script></sf-alert-bar>
  <sf-alert-bar data-k="bar-one" size="1"><script type="application/json" data-sf-settings>${BAR_ITEMS}</script></sf-alert-bar>
</section>
<section class="wide" id="${id}-wide">
  <sf-alert data-k="alert-under-wide" status="success" heading="Изменения сохранены" supporting-text="Их увидят все участники проекта."
    action-text="Открыть" action="open" actions-layout="under" closable></sf-alert>
</section>`;

const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.SF_BOOT_CONFIG={theme:false};window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<style>.zone,.wide,.bars{display:flex;flex-direction:column;gap:16px;margin:16px;max-inline-size:28rem}.wide{max-inline-size:60rem}</style>
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface">
${block('normal')}
<div data-sf-density="compact">${block('compact')}</div>
</body></html>`;

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

const KEYS = ['alert-one', 'alert-two', 'alert-class', 'alert-under-wide', 'toast-under', 'toast-class',
  'bar-half-row', 'bar-half-item', 'bar-one-row', 'bar-one-item'];

// Boxes in CSS pixels of the page (scrolled to the top, full-page shot).
const BOXES = (keys) => {
  const out = [];
  for (const density of ['normal', 'compact']) {
    const scope = density === 'normal' ? document.body : document.querySelector('[data-sf-density="compact"]');
    for (const key of keys) {
      // A bar key names the bar and its part: its row, or the first row of
      // its open list.
      const bar = key.match(/^(bar-[a-z]+)-(row|item)$/u);
      const host = [...scope.querySelectorAll(`[data-k="${bar ? bar[1] : key}"]`)].find((node) => (density === 'compact') === Boolean(node.closest('[data-sf-density="compact"]')));
      const root = bar ? host?.querySelector(bar[2] === 'row' ? '.sf-alert-bar-row' : '.sf-alert-bar-item')
        : host?.matches('.sf-alert, .sf-toast') ? host : host?.querySelector(':scope > .sf-alert, :scope > .sf-toast');
      if (!root) { out.push({density, key, missing: true}); continue; }
      const b = root.getBoundingClientRect();
      const s = getComputedStyle(root);
      const inner = {top: b.top + scrollY + parseFloat(s.borderTopWidth), bottom: b.bottom + scrollY - parseFloat(s.borderBottomWidth),
        left: b.left + parseFloat(s.borderLeftWidth), right: b.right - parseFloat(s.borderRightWidth)};
      const icon = root.querySelector(':scope > .sf-icon, :scope > sf-icon > .sf-icon');
      const buttons = [...root.querySelectorAll(bar ? ':scope > :is(.sf-alert-bar-actions, .sf-alert-bar-item-actions) .sf-button' : '.sf-alert-buttons .sf-button, .sf-toast-bottom .sf-button')];
      const last = buttons.reduce((low, one) => (!low || one.getBoundingClientRect().bottom > low.getBoundingClientRect().bottom ? one : low), null);
      const title = root.querySelector('.sf-alert-text, .sf-toast-text, .sf-alert-bar-message, .sf-alert-bar-item-message');
      const i = icon.getBoundingClientRect();
      const t = title.getBoundingClientRect();
      const fontSize = parseFloat(getComputedStyle(title).fontSize);
      out.push({density, key, inner,
        icon: {left: i.left, right: i.right, top: i.top + scrollY, bottom: i.bottom + scrollY, color: getComputedStyle(icon).color},
        letter: {left: t.left, right: t.left + fontSize * 0.6, top: t.top + scrollY, bottom: t.top + scrollY + parseFloat(getComputedStyle(title).lineHeight), color: getComputedStyle(title).color},
        lastBottom: last ? last.getBoundingClientRect().bottom + scrollY : null, buttons: buttons.length,
        under: buttons.length ? buttons.every((one) => one.getBoundingClientRect().top >= t.bottom - 0.5) : false,
        // The notice's own fill: in the gap between the icon and the title, on
        // the icon's first row (clear of the rounded corner and the border).
        fill: {x: (i.right + t.left) / 2, y: i.top + scrollY + 1}});
    }
  }
  return out;
};

const INK = async ({png, boxes, ratio}) => {
  const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
  const canvas = new OffscreenCanvas(image.width, image.height);
  const context = canvas.getContext('2d', {willReadFrequently: true});
  context.drawImage(image, 0, 0);
  const rgb = (css) => {
    context.save();
    context.fillStyle = '#000';
    context.fillStyle = css;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    context.restore();
    return [r, g, b];
  };
  const firstInk = (area, fill, ink) => {
    const x0 = Math.floor(area.left * ratio); const x1 = Math.ceil(area.right * ratio);
    const y0 = Math.floor(area.top * ratio); const y1 = Math.ceil(area.bottom * ratio);
    const data = context.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    const span = Math.max(...ink.map((v, c) => Math.abs(v - fill[c])), 1);
    for (let y = 0; y < y1 - y0; y += 1) {
      for (let x = 0; x < x1 - x0; x += 1) {
        const at = (y * (x1 - x0) + x) * 4;
        const away = Math.max(...[0, 1, 2].map((c) => Math.abs(data[at + c] - fill[c])));
        if (away / span >= 0.5) return (y0 + y) / ratio;
      }
    }
    return null;
  };
  return boxes.map((box) => {
    if (box.missing) return box;
    const fx = Math.round(box.fill.x * ratio); const fy = Math.round(box.fill.y * ratio);
    const fill = [...context.getImageData(fx, fy, 1, 1).data].slice(0, 3);
    // The icon's colour as drawn: an opaque colour is itself; a translucent one
    // is laid over the fill.
    const ink = rgb(box.icon.color);
    const iconTop = firstInk(box.icon, fill, ink);
    const capTop = firstInk(box.letter, fill, rgb(box.letter.color));
    return {...box, fill, iconTop, capTop};
  });
};

const r = (value) => (value === null || value === undefined ? value : Math.round(value * 100) / 100);
const failures = [];
const report = {};
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    for (const theme of ['light', 'dark']) {
      const view = `${width}-${theme}`;
      for (let load = 1; load <= 3; load += 1) {
        const tab = await browser.newPage({viewport: {width, height: 1400}, deviceScaleFactor: 2});
        const errors = [];
        tab.on('pageerror', (error) => errors.push(error.message));
        tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        await tab.goto(`http://127.0.0.1:${server.address().port}/?theme=${theme}`);
        await tab.waitForFunction(() => document.querySelectorAll('sf-alert > .sf-alert').length === 6
          && document.querySelectorAll('sf-toast > .sf-toast').length === 2
          && document.querySelectorAll('sf-alert .sf-alert-buttons .sf-button, sf-toast .sf-toast-bottom .sf-button').length === 10, null, {timeout: 30000})
          .catch(() => failures.push(`${view} load ${load}: the page never drew its notices`));
        // Each bar opens its list (the others), as a person does.
        await tab.waitForFunction(() => document.querySelectorAll('sf-alert-bar .sf-alert-bar-row .sf-alert-bar-all button').length === 4, null, {timeout: 30000})
          .catch(() => failures.push(`${view} load ${load}: the bars never drew «Ещё N»`));
        for (const toggle of await tab.$$('sf-alert-bar .sf-alert-bar-row .sf-alert-bar-all button')) await toggle.click();
        await tab.waitForFunction(() => document.querySelectorAll('sf-alert-bar .sf-alert-bar-item .sf-alert-bar-item-actions .sf-button').length === 8, null, {timeout: 30000})
          .catch(() => failures.push(`${view} load ${load}: the bars never opened their lists`));
        // The status icon is a ligature of the icon font: wait until a face of
        // it is in, or the glyph is a word or nothing.
        await tab.waitForFunction(() => [...document.fonts].some((face) => face.family.replace(/["']/gu, '').startsWith('Material Symbols') && face.status === 'loaded'), null, {timeout: 30000})
          .catch(() => failures.push(`${view} load ${load}: the icon font never loaded`));
        await tab.evaluate(() => document.fonts.ready);
        await tab.waitForTimeout(400);
        const boxes = await tab.evaluate(BOXES, KEYS);
        const png = (await tab.screenshot({fullPage: true})).toString('base64');
        const read = await tab.evaluate(INK, {png, boxes, ratio: 2});
        if (errors.length) failures.push(`${view} load ${load}: console ${JSON.stringify(errors)}`);
        const seen = {};
        for (const one of read) {
          const name = `${one.density} ${one.key}`;
          if (one.missing) { seen[name] = {missing: true}; continue; }
          const above = one.icon.top + (one.icon.bottom - one.icon.top) / 8 - one.inner.top;
          const drawn = one.iconTop === null ? null : one.iconTop - one.inner.top;
          const under = one.lastBottom === null ? null : one.inner.bottom - one.lastBottom;
          seen[name] = {above: r(above), under: r(under), diff: r(under - above), drawn: r(drawn), drawnDiff: r(drawn === null ? null : under - drawn), capitals: r(one.capTop === null ? null : one.capTop - one.inner.top),
            iconBox: r(one.icon.top - one.inner.top), height: r(one.inner.bottom - one.inner.top), buttonsUnder: one.under};
        }
        if (load === 1) {
          report[view] = seen;
          if (process.env.SHOTS) await tab.screenshot({path: join(process.env.SHOTS, `notice-even-bottom-${view}.png`), fullPage: true}).catch(() => {});
        } else if (JSON.stringify(seen) !== JSON.stringify(report[view])) {
          failures.push(`${view} load ${load}: the measurements differ from the first load`);
        }
        await tab.close();
      }
      for (const [name, one] of Object.entries(report[view] ?? {})) {
        if (one.missing) { failures.push(`${view} ${name}: not drawn`); continue; }
        if (!one.buttonsUnder) failures.push(`${view} ${name}: the actions are not under the text`);
        if (typeof one.diff !== 'number' || Number.isNaN(one.diff)) failures.push(`${view} ${name}: nothing measured (${JSON.stringify(one)})`);
        else if (Math.abs(one.diff) > 1) failures.push(`${view} ${name}: under the last button ${one.under}, above the icon ink ${one.above} (|diff| ${Math.abs(one.diff)} > 1)`);
        if (typeof one.drawnDiff !== 'number') failures.push(`${view} ${name}: the icon drew no ink`);
        else if (Math.abs(one.drawnDiff) > 1.5) failures.push(`${view} ${name}: under the last button ${one.under}, above the drawn icon ink ${one.drawn} (|diff| ${Math.abs(one.drawnDiff)} > 1.5)`);
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (jsonFile) writeFileSync(jsonFile, `${JSON.stringify({report, failures}, null, 1)}\n`);
if (reportOnly) {
  console.log(JSON.stringify(report, null, 1));
  console.log(JSON.stringify({failures}, null, 1));
  process.exit(0);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`notice-even-bottom: ${Object.keys(report).length} views x 2 densities x ${KEYS.length} notices x 3 loads, under the last button = above the icon ink within 1`);
