#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output [--report]
//
// The pressed look of a toggle (owner decision 2026-11-07, docs review R028,
// rule C12), on the built bytes over the Loader, in the light and the dark
// theme, three loads each:
//
//   - not pressed, a toggle keeps its own look (an outline button: its edge,
//     no fill, the icon outlined);
//   - pressed -- sf-button / sf-button-icon pressed, or plain markup's
//     aria-pressed="true" -- it wears --sf-primary-container, no visible edge
//     (the border keeps its width, transparent), the label and the icon in
//     --sf-on-primary-container, the icon filled (FILL 1): two cues;
//   - the height of a size does not move between off and on (C01);
//   - the ink on the fill (composited over the page) is at least 4.5:1;
//   - hover over a pressed toggle steps the container (-hover);
//   - text-pressed / label-pressed change the label or name and then no
//     aria-pressed is written; pressed alone writes aria-pressed;
//   - a group of three (B / I / U) with one pressed: one filled segment, three
//     of one height;
//   - a disabled pressed toggle wears the disabled look and keeps the filled
//     icon; the setting turns the look on and off without a reload.
//
// --report prints the measurements and exits 0 whatever they say.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const reportOnly = process.argv.includes('--report');
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};

const SIZES = ['1/3', '1/2', '1', '2', '3'];

const body = () => `
${SIZES.map((size) => `<div class="row" data-size="${size}">
  <sf-button size="${size}" appearance="outline" scheme="on-surface" text="Жирный" icon-start="format_bold" pressed="false" data-k="off"></sf-button>
  <sf-button size="${size}" appearance="outline" scheme="on-surface" text="Жирный" icon-start="format_bold" pressed data-k="on"></sf-button>
  <sf-button size="${size}" appearance="tonal" scheme="primary" text="Тональная" icon-start="star" data-k="tonal"></sf-button>
  <sf-button-icon size="${size}" appearance="outline" scheme="on-surface" icon="format_bold" aria-label="Жирный" pressed="false" data-k="icon-off"></sf-button-icon>
  <sf-button-icon size="${size}" appearance="outline" scheme="on-surface" icon="format_bold" aria-label="Жирный" pressed data-k="icon-on"></sf-button-icon>
</div>`).join('\n')}
<div class="row" data-size="extra">
  <sf-button appearance="outline" scheme="on-surface" text="В избранное" text-pressed="В избранном" icon-start="star" pressed="false" data-k="fav-off"></sf-button>
  <sf-button appearance="outline" scheme="on-surface" text="В избранное" text-pressed="В избранном" icon-start="star" pressed data-k="fav-on"></sf-button>
  <sf-button-icon appearance="link" scheme="on-surface" icon="star" aria-label="Добавить в избранное" label-pressed="Убрать из избранного" pressed data-k="icon-fav-on"></sf-button-icon>
  <sf-button appearance="default" scheme="primary" text="Уведомления" icon-start="notifications" pressed data-k="default-on"></sf-button>
  <sf-button appearance="link" scheme="on-surface" text="Перенос" icon-start="wrap_text" pressed data-k="link-on"></sf-button>
  <sf-button appearance="outline" scheme="on-surface" text="Жирный" icon-start="format_bold" pressed disabled data-k="disabled-on"></sf-button>
  <button type="button" class="sf-button sf-button--outline sf-button--on-surface sf-button--size-1 flex items-cross-center" aria-pressed="true" data-k="plain-on"><span class="sf-button-text-container">Жирный</span></button>
  <sf-button appearance="outline" scheme="on-surface" text="Курсив" icon-start="format_italic" pressed="false" data-k="flip"></sf-button>
</div>
<div class="row" data-size="group">
  <div class="sf-button-group" role="group" aria-label="Форматирование">
    <sf-button-icon appearance="outline" scheme="on-surface" segment="start" icon="format_bold" aria-label="Жирный" pressed data-k="b"></sf-button-icon>
    <sf-button-icon appearance="outline" scheme="on-surface" segment="middle" icon="format_italic" aria-label="Курсив" pressed="false" data-k="i"></sf-button-icon>
    <sf-button-icon appearance="outline" scheme="on-surface" segment="end" icon="format_underlined" aria-label="Подчёркнутый" pressed="false" data-k="u"></sf-button-icon>
  </div>
</div>
<span id="pc" style="color: var(--sf-primary-container)">x</span>
<span id="pc-hover" style="color: var(--sf-primary-container-hover)">x</span>
<span id="on-pc" style="color: var(--sf-on-primary-container)">x</span>
<span id="outline" style="color: var(--sf-outline)">x</span>`;

const page = (theme) => `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<link rel="stylesheet" href="/distr/component/buttons/css/buttons.css">
<link rel="stylesheet" href="/distr/component/icon-buttons/css/icon-buttons.css">
<style>.row{display:flex;flex-wrap:wrap;align-items:flex-start;gap:12px;margin:12px 16px}</style>
<script src="/distr/core/js/core.js"></script></head><body class="bg-surface">${body()}</body></html>`;

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

// Everything is measured in the page: colours are composited on a canvas
// (the container fill is an alpha step over the page), contrast is WCAG's.
const MEASURE = () => {
  const round = (value) => Math.round(value * 100) / 100;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  const rgb = (...layers) => {
    context.clearRect(0, 0, 1, 1);
    for (const layer of layers) { context.fillStyle = layer; context.fillRect(0, 0, 1, 1); }
    return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const luminance = (channels) => {
    const [r, g, b] = channels.map((value) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return round((high + 0.05) / (low + 0.05));
  };
  const page = getComputedStyle(document.body).backgroundColor;
  const cells = {};
  for (const host of document.querySelectorAll('[data-k]')) {
    const key = host.dataset.k;
    // A host hands its data-* to the button it draws: measure the control once.
    if (host.parentElement?.closest(`[data-k="${key}"]`)) continue;
    const button = host.matches('.sf-button, .sf-icon-button') ? host : host.querySelector('.sf-button, .sf-icon-button');
    const row = host.closest('.row').dataset.size;
    if (!button) { cells[`${row} ${key}`] = null; continue; }
    const style = getComputedStyle(button);
    const label = button.querySelector('.sf-button-text-container');
    const icon = button.querySelector('.sf-icon');
    const fill = rgb(page, style.backgroundColor);
    const labelColor = label ? getComputedStyle(label).color : null;
    const iconColor = icon ? getComputedStyle(icon).color : null;
    cells[`${row} ${key}`] = {
      h: round(button.getBoundingClientRect().height),
      // An icon button's width is its size; a labelled one's follows the text
      // face, which may still be arriving, so it is not compared between loads.
      w: label ? null : round(button.getBoundingClientRect().width),
      borderWidth: style.borderTopWidth,
      borderColor: style.borderTopColor,
      fill: style.backgroundColor,
      label: labelColor,
      text: label ? label.textContent.trim() : null,
      icon: iconColor,
      iconFill: icon ? /"FILL" 1\b/u.test(getComputedStyle(icon).fontVariationSettings) : null,
      pressedClass: button.classList.contains('sf-button--pressed') || button.classList.contains('sf-icon-button--pressed'),
      active: button.classList.contains('active'),
      ariaPressed: button.getAttribute('aria-pressed'),
      name: button.getAttribute('aria-label'),
      labelContrast: labelColor ? contrast(rgb(labelColor), fill) : null,
      iconContrast: iconColor ? contrast(rgb(page, style.backgroundColor, iconColor), fill) : null,
    };
  }
  const color = (id) => getComputedStyle(document.getElementById(id)).color;
  return {cells, page, pc: color('pc'), pcHover: color('pc-hover'), onPc: color('on-pc'), outline: color('outline')};
};

const failures = [];
const report = {};
const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (let load = 1; load <= 3; load += 1) {
      // The Loader writes the theme class from the system's preference.
      const tab = await browser.newPage({viewport: {width: 1280, height: 900}, colorScheme: theme});
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      tab.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await tab.goto(`http://127.0.0.1:${server.address().port}/?theme=${theme}`);
      const hosts = await tab.evaluate(() => document.querySelectorAll('sf-button, sf-button-icon').length);
      await tab.waitForFunction((count) => customElements.get('sf-button') && customElements.get('sf-button-icon')
        && document.querySelectorAll('sf-button > .sf-button, sf-button-icon > .sf-icon-button').length === count
        && [...document.querySelectorAll('sf-button > .sf-button, sf-button-icon > .sf-icon-button')].every((button) => button.querySelector('.sf-icon')),
      hosts, {timeout: 30000})
        .catch(() => failures.push(`${theme} load ${load}: the page never drew its buttons`));
      // The icon face is the runtime's subset of the glyphs on the page; until
      // it is in place an icon is drawn by a face that may not hold the
      // filled instance, and a picture would show an outlined glyph.
      await tab.waitForFunction(() => document.documentElement.getAttribute('data-sf-icons') !== 'subset-pending', null, {timeout: 15000})
        .catch(() => failures.push(`${theme} load ${load}: the icon subset never arrived`));
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(1000);
      if (!await tab.evaluate((name) => document.documentElement.classList.contains(`theme-${name}`), theme)) failures.push(`${theme} load ${load}: the page is not in that theme`);
      const seen = await tab.evaluate(MEASURE);

      // Hovered: a pressed toggle steps its container.
      const hovered = tab.locator('.row[data-size="1"] [data-k="on"]').last();
      await hovered.hover();
      await tab.waitForTimeout(300);
      seen.hover = await hovered.evaluate((button) => ({
        fill: getComputedStyle(button).backgroundColor,
        label: getComputedStyle(button.querySelector('.sf-button-text-container')).color,
      }));
      await tab.mouse.move(0, 0);
      await tab.waitForTimeout(300);

      if (load === 1) {
        await tab.screenshot({path: join(process.env.SHOTS ?? '/tmp', `button-pressed-${theme}.png`), fullPage: true}).catch(() => {});
      }

      // The setting turns the look on and off without a reload.
      seen.flip = {};
      for (const state of [true, false]) {
        await tab.evaluate((on) => { document.querySelector('[data-k="flip"]').closest('sf-button').pressed = on; }, state);
        await tab.waitForTimeout(300);
        seen.flip[state] = await tab.evaluate(() => {
          const button = document.querySelector('[data-k="flip"]').closest('sf-button').querySelector('.sf-button');
          return {
            fill: getComputedStyle(button).backgroundColor,
            ariaPressed: button.getAttribute('aria-pressed'),
            iconFill: /"FILL" 1\b/u.test(getComputedStyle(button.querySelector('.sf-icon')).fontVariationSettings),
          };
        });
      }

      if (errors.length) failures.push(`${theme} load ${load}: console ${JSON.stringify(errors)}`);
      if (load === 1) report[theme] = seen;
      else if (JSON.stringify(seen) !== JSON.stringify(report[theme])) {
        const first = report[theme];
        const differ = [
          ...Object.keys(seen.cells).filter((key) => JSON.stringify(seen.cells[key]) !== JSON.stringify(first.cells[key]))
            .map((key) => `${key}: ${JSON.stringify(first.cells[key])} -> ${JSON.stringify(seen.cells[key])}`),
          ...['hover', 'flip'].filter((key) => JSON.stringify(seen[key]) !== JSON.stringify(first[key])).map((key) => `${key}: ${JSON.stringify(first[key])} -> ${JSON.stringify(seen[key])}`),
        ];
        failures.push(`${theme} load ${load}: the measurements differ from the first load (${differ.join('; ')})`);
      }
      await tab.close();
    }

    const {cells, pc, pcHover, onPc, outline, hover, flip} = report[theme];
    const fail = (message) => failures.push(`${theme}: ${message}`);
    const pressedLook = (key, {label = true} = {}) => {
      const cell = cells[key];
      if (!cell) return fail(`${key} not drawn`);
      if (cell.fill !== pc) fail(`${key} fill ${cell.fill}, --sf-primary-container ${pc}`);
      if (cell.borderColor !== 'rgba(0, 0, 0, 0)') fail(`${key} edge ${cell.borderColor}, transparent expected`);
      if (label && cell.label !== onPc) fail(`${key} label ${cell.label}, --sf-on-primary-container ${onPc}`);
      if (cell.icon !== null && cell.icon !== onPc) fail(`${key} icon ${cell.icon}, --sf-on-primary-container ${onPc}`);
      if (cell.icon !== null && !cell.iconFill) fail(`${key} icon not filled`);
      if (label && cell.labelContrast < 4.5) fail(`${key} label contrast ${cell.labelContrast}:1 under 4.5:1`);
      if (cell.iconContrast !== null && cell.iconContrast < 4.5) fail(`${key} icon contrast ${cell.iconContrast}:1 under 4.5:1`);
    };
    for (const size of SIZES) {
      const off = cells[`${size} off`];
      const on = cells[`${size} on`];
      const iconOff = cells[`${size} icon-off`];
      const iconOn = cells[`${size} icon-on`];
      if (!off || !on || !iconOff || !iconOn) { fail(`size ${size}: not drawn`); continue; }
      pressedLook(`${size} on`);
      pressedLook(`${size} icon-on`, {label: false});
      for (const [name, cell] of [['off', off], ['icon-off', iconOff]]) {
        if (cell.fill === pc) fail(`size ${size} ${name}: wears the pressed fill`);
        if (cell.borderColor !== outline) fail(`size ${size} ${name}: edge ${cell.borderColor}, --sf-outline ${outline}`);
        if (cell.iconFill) fail(`size ${size} ${name}: icon filled while off`);
        if (cell.ariaPressed !== 'false') fail(`size ${size} ${name}: aria-pressed ${cell.ariaPressed}`);
      }
      if (on.ariaPressed !== 'true' || iconOn.ariaPressed !== 'true') fail(`size ${size}: pressed says aria-pressed ${on.ariaPressed} / ${iconOn.ariaPressed}`);
      if (on.active || iconOn.active) fail(`size ${size}: pressed still writes the active class`);
      if (on.h !== off.h || on.borderWidth !== off.borderWidth) fail(`size ${size}: on ${on.h}px / ${on.borderWidth}, off ${off.h}px / ${off.borderWidth}`);
      if (iconOn.h !== iconOff.h || iconOn.w !== iconOff.w) fail(`size ${size}: icon on ${iconOn.w}x${iconOn.h}, off ${iconOff.w}x${iconOff.h}`);
      const tonal = cells[`${size} tonal`];
      if (tonal && tonal.h !== on.h) fail(`size ${size}: tonal ${tonal.h}px, pressed outline ${on.h}px`);
    }
    if (hover.fill !== pcHover) fail(`hovered pressed fill ${hover.fill}, --sf-primary-container-hover ${pcHover}`);
    if (hover.label !== onPc) fail(`hovered pressed label ${hover.label}`);

    const favOff = cells['extra fav-off'];
    const favOn = cells['extra fav-on'];
    pressedLook('extra fav-on');
    if (favOff?.text !== 'В избранное' || favOn?.text !== 'В избранном') fail(`text-pressed: labels «${favOff?.text}» / «${favOn?.text}»`);
    if (favOff?.ariaPressed !== null || favOn?.ariaPressed !== null) fail(`text-pressed: aria-pressed ${favOff?.ariaPressed} / ${favOn?.ariaPressed}, none expected`);
    if (favOff?.fill === pc || favOff?.iconFill) fail('text-pressed off wears the pressed look');
    const iconFav = cells['extra icon-fav-on'];
    pressedLook('extra icon-fav-on', {label: false});
    if (iconFav?.name !== 'Убрать из избранного' || iconFav?.ariaPressed !== null) fail(`label-pressed: name «${iconFav?.name}», aria-pressed ${iconFav?.ariaPressed}`);
    pressedLook('extra default-on');
    pressedLook('extra link-on');
    pressedLook('extra plain-on');
    const disabled = cells['extra disabled-on'];
    if (!disabled || disabled.fill === pc || !disabled.iconFill) fail(`disabled pressed: fill ${disabled?.fill}, icon filled ${disabled?.iconFill}`);
    if (flip.true.fill !== pc || flip.true.ariaPressed !== 'true' || !flip.true.iconFill) fail(`pressed = true: ${JSON.stringify(flip.true)}`);
    if (flip.false.fill === pc || flip.false.ariaPressed !== 'false' || flip.false.iconFill) fail(`pressed = false: ${JSON.stringify(flip.false)}`);

    const [b, i, u] = ['b', 'i', 'u'].map((key) => cells[`group ${key}`]);
    if (!b || !i || !u) fail('the B / I / U group is not drawn');
    else {
      if (b.fill !== pc || !b.iconFill || b.ariaPressed !== 'true') fail(`group: B ${JSON.stringify(b)}`);
      for (const [name, cell] of [['I', i], ['U', u]]) {
        if (cell.fill === pc || cell.iconFill || cell.ariaPressed !== 'false') fail(`group: ${name} ${JSON.stringify(cell)}`);
      }
      if (new Set([b.h, i.h, u.h]).size !== 1) fail(`group: heights ${b.h} ${i.h} ${u.h}`);
      if (b.iconContrast < 4.5) fail(`group: B icon contrast ${b.iconContrast}:1`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({report: Object.fromEntries(Object.entries(report).map(([theme, seen]) => [theme, {
  page: seen.page,
  primaryContainer: seen.pc,
  onPrimaryContainer: seen.onPc,
  heights: Object.fromEntries(SIZES.map((size) => [size, {off: seen.cells[`${size} off`]?.h, on: seen.cells[`${size} on`]?.h, iconOff: seen.cells[`${size} icon-off`]?.h, iconOn: seen.cells[`${size} icon-on`]?.h}])),
  contrast: Object.fromEntries(Object.entries(seen.cells).filter(([, cell]) => cell && cell.fill === seen.pc).map(([key, cell]) => [key, {label: cell.labelContrast, icon: cell.iconContrast}])),
  size1: {off: seen.cells['1 off'], on: seen.cells['1 on']},
  extra: Object.fromEntries(Object.entries(seen.cells).filter(([key]) => key.startsWith('extra') || key.startsWith('group'))),
  hover: seen.hover,
  flip: seen.flip,
}])), failures}, null, 1));
process.exitCode = failures.length && !reportOnly ? 1 : 0;
